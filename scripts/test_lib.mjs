/* Unit tests for the pure logic that drives the live number.
   Run: npm test  (compiles lib/*.ts to /tmp then asserts) */
import assert from "node:assert/strict";

const L = process.env.LIB_OUT ?? "/tmp/gw-lib";
const { parseTravelMinutes, parseTocDuration, tocToSamples, mergeSamples, dedupeByAt } =
  await import(`${L}/parse.mjs`);
const { waitColor, waitWord, fmtClock, fmtMins } = await import(`${L}/format.mjs`);
const { combine } = await import(`${L}/historical.mjs`);

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message.split("\n")[0]}`); }
};

/* ---------------------------------------------- @bmantraffic text parsing */
const TT = [
  ["The current travel time from Gravel to Gate is 20 minutes. 🏎️", 20],
  ["The current travel time from Gravel to Gate is 2 hours, 30 minutes. 🚗", 150],
  ["The current travel time from Gravel to Gate is 3 hours.🚗", 180],
  ["The current travel time from Gravel to Gate is 2 hours", 120],
  ["Current average travel time to Gate is: 1 hour and 10 minutes.", 70],
  ["Travel time from pavement to Gate is currently approximately 2 hours and 30 minutes.", 150],
  ["Travel time from pavement to Gate is 20m. Tune into GARS at 95.1", 20],
  ["Current average travel time from pavement to Gate is 1-2 hours.", 90],
  ["Current average travel time to Gate is 1 to 2 hours.", 90],
  ["Travel time to Gate is 45-60 minutes.", 53],
  ["Travel time to Gate is 2–3 hours.", 150],
  ["Current average travel time on Gate Road is 1 hour and 40 minutes.", 100],
  ["Current average travel time to Gate is 90 minutes. The speed limit on gate road is 10 MPH.", 90],
  // must be ignored
  ["The Gate into Black Rock City is still closed due to rain.", null],
  ["Travel time from Gate to Gravel is 2 hours.", null],   // exodus direction
  ["Please drive safely and watch for pedestrians.", null],
];
for (const [txt, want] of TT) {
  t(`parse: ${txt.slice(0, 48)}`, () => assert.equal(parseTravelMinutes(txt), want));
}

/* ------------------------------------------------------ TOC duration text */
for (const [s, want] of [["0 h, 40 m", 40], ["2 h, 0 m", 120], ["1h 15m", 75], ["0 h, 20 m", 20], ["", null], ["--", null]]) {
  t(`toc dur "${s}"`, () => assert.equal(parseTocDuration(s), want));
}

/* --------------------------------- TOC rows anchor to the right instant */
// serverTime = 2026-08-29T15:00:00Z == 08:00 PDT
const server = Date.parse("2026-08-29T15:00:00.000Z");
const rows = [["7:30 AM", "0 h, 40 m", ""], ["2:00 AM", "2 h, 0 m", ""], ["11:00 PM", "1 h, 0 m", ""]];
const samples = tocToSamples(rows, server);
t("toc: three rows parsed", () => assert.equal(samples.length, 3));
t("toc: 7:30 AM -> 14:30Z same day", () =>
  assert.equal(samples.find(s => s.raw.startsWith("7:30")).at, "2026-08-29T14:30:00.000Z"));
t("toc: 2:00 AM -> 09:00Z same day", () =>
  assert.equal(samples.find(s => s.raw.startsWith("2:00")).at, "2026-08-29T09:00:00.000Z"));
t("toc: 11:00 PM rolls back a day", () =>
  assert.equal(samples.find(s => s.raw.startsWith("11:00")).at, "2026-08-29T06:00:00.000Z"));
t("toc: nothing in the future", () =>
  assert.ok(samples.every(s => Date.parse(s.at) <= server + 60000)));
t("toc: ascending", () => {
  const at = samples.map(s => s.at);
  assert.deepEqual(at, [...at].sort());
});
t("toc: junk ignored", () => assert.equal(tocToSamples([["nope", "x"], "bad", null], server).length, 0));

/* --------------------------------------------------------- merge / dedupe */
t("merge prefers toc over tweet in the same 5-min bucket", () => {
  const a = [{ at: "2026-08-29T14:30:00.000Z", minutes: 40, source: "toc" }];
  const b = [{ at: "2026-08-29T14:31:00.000Z", minutes: 55, source: "bmantraffic" }];
  const m = mergeSamples(b, a);
  assert.equal(m.length, 1);
  assert.equal(m[0].source, "toc");
});
t("merge keeps distinct times", () => {
  const m = mergeSamples(
    [{ at: "2026-08-29T14:00:00.000Z", minutes: 40, source: "toc" }],
    [{ at: "2026-08-29T15:00:00.000Z", minutes: 50, source: "toc" }],
  );
  assert.equal(m.length, 2);
});
t("dedupe keeps last per timestamp", () => {
  const r = dedupeByAt([{ at: "x", v: 1 }, { at: "x", v: 2 }]);
  assert.equal(r.length, 1);
});

/* ----------------------------------------------- ramp thresholds + labels */
const bands = [
  [0, "--r1", "moving"], [44, "--r1", "moving"],
  [45, "--r2", "normal"], [89, "--r2", "normal"],
  [90, "--r3", "slow"], [149, "--r3", "slow"],
  [150, "--r4", "heavy"], [239, "--r4", "heavy"],
  [240, "--r5", "brutal"], [600, "--r5", "brutal"],
];
for (const [m, colour, word] of bands) {
  t(`ramp ${m}m -> ${colour}`, () => assert.ok(waitColor(m).includes(colour), `${m} gave ${waitColor(m)}`));
  t(`word ${m}m -> ${word}`, () => assert.equal(waitWord(m), word));
}
t("ramp is monotonic", () => {
  const order = ["--r1", "--r2", "--r3", "--r4", "--r5"];
  let last = 0;
  for (let m = 0; m <= 600; m += 5) {
    const i = order.findIndex(o => waitColor(m).includes(o));
    assert.ok(i >= last, `ramp went backwards at ${m}m`);
    last = i;
  }
});
t("null wait is neutral, not green", () => {
  assert.ok(!waitColor(null).includes("--r1"));
  assert.equal(waitWord(null), "no data");
});

/* ---------------------------------------------------------------- clocks */
for (const [m, want] of [[20, "0:20"], [60, "1:00"], [220, "3:40"], [0, "0:00"], [null, "—:—"]]) {
  t(`fmtClock ${m}`, () => assert.equal(fmtClock(m), want));
}
for (const [m, want] of [[20, "20m"], [60, "1h"], [150, "2h 30m"], [null, "—"]]) {
  t(`fmtMins ${m}`, () => assert.equal(fmtMins(m), want));
}

/* -------------------------------------------------- cross-year combining */
t("combine min", () => assert.equal(combine([60, 20, 480], "min"), 20));
t("combine max", () => assert.equal(combine([60, 20, 480], "max"), 480));
t("combine median odd", () => assert.equal(combine([60, 20, 480], "median"), 60));
t("combine median even", () => assert.equal(combine([20, 60], "median"), 40));
t("combine mean", () => assert.equal(combine([60, 20, 40], "mean"), 40));
t("combine min <= median <= max", () => {
  const v = [15, 400, 62, 240, 88];
  assert.ok(combine(v, "min") <= combine(v, "median"));
  assert.ok(combine(v, "median") <= combine(v, "max"));
  assert.ok(combine(v, "min") <= combine(v, "mean"));
  assert.ok(combine(v, "mean") <= combine(v, "max"));
});
t("combine single value", () => assert.equal(combine([77], "median"), 77));

console.log(`\n${pass + fail} assertions, ${fail} failures`);
process.exit(fail ? 1 : 0);

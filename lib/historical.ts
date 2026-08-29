export type Stat = "median" | "mean" | "min" | "max";

export const STATS: { id: Stat; label: string; prose: string; blurb: string }[] = [
  { id: "median", label: "MEDIAN", prose: "median",
    blurb: "the middle reading — the typical hour, unmoved by one bad day" },
  { id: "mean", label: "AVG", prose: "average",
    blurb: "the arithmetic mean — one long stall drags it up" },
  { id: "min", label: "MIN", prose: "shortest reading",
    blurb: "the best it ever got in that slot — the optimistic case" },
  { id: "max", label: "MAX", prose: "longest reading",
    blurb: "the worst it ever got in that slot — the case to plan around" },
];

export type HistCell = {
  day: string; hour: number;
  median: number; mean: number; min: number; max: number; n: number;
};
export type HistDay = {
  label: string; offset: number; date: string;
  median: number; mean: number; min: number; max: number; n: number; note?: string;
};
export type HistPhase = { days: HistDay[]; cells: HistCell[] };
export type HistYear = { label: string; note: string; arrival: HistPhase; exodus: HistPhase };

export type Historical = {
  status: "pending" | "ok";
  generatedAt: string | null;
  coverageYears: number[];
  defaultYear?: string;
  /** years dense enough to rank arrival windows against */
  rankingYears?: string[];
  days: string[];
  years: Record<string, HistYear>;
  insights: { text: string; sourceUrl?: string | null; years?: number[] | null }[];
  sources: { title: string; url: string; year?: number }[];
  primarySource?: { title: string; url: string };
};

/** Combine one statistic across several years the same way it was computed within a year. */
export function combine(vals: number[], stat: Stat): number {
  if (vals.length === 0) return NaN;
  if (stat === "min") return Math.min(...vals);
  if (stat === "max") return Math.max(...vals);
  if (stat === "mean") return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

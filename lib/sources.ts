import type { BannerMessage, Forecast, GateStatus, SocialPost, TrafficPost } from "./types";
import { parseTravelMinutes } from "./parse";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export const BRC = "https://brcdashboard.burningman.org";

async function get(url: string, init: RequestInit = {}, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctl.signal,
      cache: "no-store",
      headers: { "user-agent": UA, accept: "*/*", ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

/* ---------------------------------------------------------------- BRC feed */

export type BrcFeed = {
  serverTime: number;
  messages: any[];
  synced: {
    toc?: unknown;
    traffic?: any[];
    weather?: string[];
    weather_forecasts?: Forecast[];
    traffic_visibility?: boolean;
    gate_status_visibility?: boolean;
    placeholder_mode?: boolean;
    traffic_window_hours?: number;
    dj_schedule?: any[];
  };
  feeds?: Record<string, boolean>;
};

export async function fetchBrcFeed(): Promise<BrcFeed> {
  const r = await get(`${BRC}/api/feed/public`);
  if (!r.ok) throw new Error(`brc feed ${r.status}`);
  return (await r.json()) as BrcFeed;
}

export async function fetchGateStatus(): Promise<GateStatus> {
  const r = await get(`${BRC}/api/gate-status`);
  if (!r.ok) throw new Error(`gate-status ${r.status}`);
  return (await r.json()) as GateStatus;
}

export async function fetchWebcast(): Promise<{ available: boolean; playbackId: string | null }> {
  const r = await get(`${BRC}/api/webcast-status`);
  if (!r.ok) throw new Error(`webcast ${r.status}`);
  const j = await r.json();
  return { available: !!j.available, playbackId: j.playbackId ?? null };
}

export function normalizeTraffic(raw: any[] | undefined): TrafficPost[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => {
      const text: string = t.note_tweet || t.text || "";
      return {
        id: String(t.id ?? text.slice(0, 24)),
        text,
        createdAt: new Date(t.created_at).toISOString(),
        author: t.author?.username ?? "bmantraffic",
        minutes: parseTravelMinutes(text),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function normalizeBanners(raw: any[] | undefined): BannerMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    let title = "";
    let color = "blue";
    try {
      const s = JSON.parse(m.subject ?? "{}");
      title = s.title ?? "";
      color = s.color ?? "blue";
    } catch {
      title = String(m.subject ?? "");
    }
    return {
      id: String(m.id),
      title,
      color,
      content: String(m.content ?? ""),
      severity: String(m.severity ?? "standard"),
      createdAt: new Date(m.created_at).toISOString(),
    };
  });
}

/* -------------------------------------------------------------------- NWS */

/** Gerlach / Black Rock Desert gridpoint, resolved once from api.weather.gov/points. */
const NWS_FORECAST = "https://api.weather.gov/gridpoints/REV/76,159/forecast";
const NWS_ALERTS = "https://api.weather.gov/alerts/active?point=40.7864,-119.2065";

export async function fetchNws() {
  const headers = { "user-agent": "brc-gate-wait (github.com/rlschlesinger)" };
  const [fRes, aRes] = await Promise.allSettled([
    get(NWS_FORECAST, { headers }),
    get(NWS_ALERTS, { headers }),
  ]);
  let headline: string | null = null;
  const alerts: { event: string; headline: string; severity: string }[] = [];

  if (fRes.status === "fulfilled" && fRes.value.ok) {
    const j = await fRes.value.json();
    headline = j?.properties?.periods?.[0]?.detailedForecast ?? null;
  }
  if (aRes.status === "fulfilled" && aRes.value.ok) {
    const j = await aRes.value.json();
    for (const f of j?.features ?? []) {
      alerts.push({
        event: f?.properties?.event ?? "Alert",
        headline: f?.properties?.headline ?? "",
        severity: f?.properties?.severity ?? "Unknown",
      });
    }
  }
  if (!headline && alerts.length === 0) throw new Error("nws empty");
  return { headline, alerts };
}

/* ------------------------------------------------------------------ social */

const GATE_WORDS =
  /\b(gate|wait|line|traffic|queue|exodus|greeter|willing worker|arriv|drive|road|447|gravel|pulsati|dust|whiteout)\w*/i;

function stripTags(s: string) {
  return s.replace(/<[^>]*>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();
}

/** Reddit's JSON API blocks datacenter IPs; the RSS feed usually still answers. */
export async function fetchReddit(): Promise<SocialPost[]> {
  // Reddit's JSON API 403s from cloud IPs and the RSS feed burns its whole rate-limit
  // budget in one request, so make exactly one call and filter client-side.
  const urls = ["https://www.reddit.com/r/BurningMan/new.rss?limit=100"];
  const posts: SocialPost[] = [];
  for (const u of urls) {
    try {
      const r = await get(u, { headers: { accept: "application/atom+xml,application/xml" } });
      if (!r.ok) continue;
      const xml = await r.text();
      for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const e = m[1];
        const title = stripTags(e.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "");
        const link = e.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "";
        const updated = e.match(/<updated>([\s\S]*?)<\/updated>/)?.[1] ?? "";
        const author = stripTags(e.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1] ?? "");
        const body = stripTags(e.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? "").slice(0, 240);
        if (!title || !link) continue;
        if (!GATE_WORDS.test(title) && !GATE_WORDS.test(body)) continue;
        posts.push({
          id: link,
          title,
          url: link,
          author,
          createdAt: updated ? new Date(updated).toISOString() : new Date().toISOString(),
          network: "reddit",
          snippet: body,
        });
      }
    } catch {
      /* try the next url */
    }
  }
  const seen = new Set<string>();
  const out = posts.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (out.length === 0) throw new Error("reddit empty");
  return out.slice(0, 25);
}

export async function fetchBluesky(): Promise<SocialPost[]> {
  const q = encodeURIComponent("burning man gate");
  const path = `/xrpc/app.bsky.feed.searchPosts?q=${q}&limit=25&sort=latest`;
  let j: any = null;
  // Same AppView behind two hostnames; one or the other is edge-blocked depending on egress IP.
  for (const host of ["https://api.bsky.app", "https://public.api.bsky.app"]) {
    try {
      const r = await get(host + path);
      if (r.ok) { j = await r.json(); break; }
    } catch { /* try the other host */ }
  }
  if (!j) throw new Error("bsky unreachable");
  const out: SocialPost[] = (j?.posts ?? [])
    .map((p: any) => {
      const rkey = String(p.uri ?? "").split("/").pop();
      const handle = p?.author?.handle ?? "unknown";
      return {
        id: p.uri,
        title: String(p?.record?.text ?? "").slice(0, 240),
        url: `https://bsky.app/profile/${handle}/post/${rkey}`,
        author: handle,
        createdAt: new Date(p?.record?.createdAt ?? Date.now()).toISOString(),
        network: "bluesky" as const,
      };
    })
    .filter((p: SocialPost) => GATE_WORDS.test(p.title));
  if (out.length === 0) throw new Error("bsky empty");
  return out.slice(0, 20);
}

export async function fetchMastodon(): Promise<SocialPost[]> {
  const r = await get("https://mastodon.social/api/v1/timelines/tag/burningman?limit=30");
  if (!r.ok) throw new Error(`mastodon ${r.status}`);
  const j = await r.json();
  const out: SocialPost[] = (Array.isArray(j) ? j : [])
    .map((s: any) => ({
      id: String(s.uri ?? s.id),
      title: stripTags(String(s.content ?? "")).slice(0, 240),
      url: String(s.url ?? s.uri ?? ""),
      author: String(s.account?.acct ?? "unknown"),
      createdAt: new Date(s.created_at ?? Date.now()).toISOString(),
      network: "mastodon" as const,
    }))
    .filter((p: SocialPost) => p.url && GATE_WORDS.test(p.title));
  if (out.length === 0) throw new Error("mastodon empty");
  return out.slice(0, 12);
}

/**
 * Open-Meteo gives wind gusts and horizontal visibility at the playa, which
 * together are the closest free proxy for "is it a whiteout right now".
 */
export async function fetchConditions() {
  const r = await get(
    "https://api.open-meteo.com/v1/forecast?latitude=40.7864&longitude=-119.2065" +
      "&current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility" +
      "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles",
  );
  if (!r.ok) throw new Error(`open-meteo ${r.status}`);
  const j = await r.json();
  const c = j?.current;
  if (!c) throw new Error("open-meteo empty");
  const visibilityM: number | null = typeof c.visibility === "number" ? c.visibility : null;
  const gust: number | null = typeof c.wind_gusts_10m === "number" ? c.wind_gusts_10m : null;
  return {
    at: String(c.time ?? ""),
    tempF: typeof c.temperature_2m === "number" ? c.temperature_2m : null,
    windMph: typeof c.wind_speed_10m === "number" ? c.wind_speed_10m : null,
    gustMph: gust,
    windDir: typeof c.wind_direction_10m === "number" ? c.wind_direction_10m : null,
    visibilityM,
    visibilityMi: visibilityM === null ? null : Math.round((visibilityM / 1609.34) * 10) / 10,
    dust: dustRisk(gust, visibilityM),
  };
}

function dustRisk(gust: number | null, visM: number | null): "calm" | "dusty" | "whiteout" | "unknown" {
  if (visM !== null && visM < 1600) return "whiteout";
  if (gust === null && visM === null) return "unknown";
  if ((gust ?? 0) >= 25 || (visM !== null && visM < 8000)) return "dusty";
  return "calm";
}

/** Roadside cameras we proxy, so the browser never has to reach them directly. */
export const CAMERAS: Record<string, { url: string; label: string; where: string }> = {
  brc: {
    url: "https://webcam.burningman.org/",
    label: "Bruno's, Gerlach",
    where: "Last town before the playa — the only camera on the 447 corridor.",
  },
  nv447: {
    url: "https://www.nvroads.com/map/cctv/7105",
    label: "I-80 EB Wadsworth",
    where: "NDOT truck check at the NV-447 turnoff, ~90 min upstream of the Gate.",
  },
};

export type CameraStatus = {
  id: string; label: string; where: string;
  /** seconds since the frame was captured, or null when the host sends no Last-Modified */
  ageSec: number | null;
  ok: boolean;
};

/**
 * Cameras fail by going stale, not by going away — Bruno's happily serves a
 * hours-old night frame stamped 1/4/1970. Ask for the headers so the page can
 * say how old the picture is instead of implying it is now.
 */
export async function fetchCameraStatus(): Promise<CameraStatus[]> {
  const out = await Promise.all(
    Object.entries(CAMERAS).map(async ([id, c]) => {
      try {
        const r = await get(`${c.url}${c.url.includes("?") ? "&" : "?"}t=${Date.now()}`, { method: "HEAD" }, 6000);
        const lm = r.headers.get("last-modified");
        return {
          id, label: c.label, where: c.where,
          ageSec: lm ? Math.max(0, Math.round((Date.now() - Date.parse(lm)) / 1000)) : null,
          ok: r.ok,
        };
      } catch {
        return { id, label: c.label, where: c.where, ageSec: null, ok: false };
      }
    }),
  );
  if (!out.some((c) => c.ok)) throw new Error("cameras unreachable");
  return out;
}

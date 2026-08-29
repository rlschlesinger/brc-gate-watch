export type WaitSample = {
  /** ISO instant the observation refers to */
  at: string;
  /** travel time Gravel -> Gate, in minutes */
  minutes: number;
  source: "toc" | "bmantraffic" | "manual";
  raw?: string;
};

export type GateStatus = {
  inbound: string | null;
  outbound: string | null;
  status: string | null;
};

export type TrafficPost = {
  id: string;
  text: string;
  createdAt: string;
  author: string;
  minutes: number | null;
};

export type Forecast = {
  date: string;
  high: string;
  low: string;
  message: string;
  icon?: string;
  windDirection?: string;
  gust?: string;
  nightMessage?: string;
  nightGust?: string;
};

export type BannerMessage = {
  id: string;
  title: string;
  color: string;
  content: string;
  severity: string;
  createdAt: string;
};

export type SocialPost = {
  id: string;
  title: string;
  url: string;
  author: string;
  createdAt: string;
  network: "reddit" | "bluesky" | "mastodon";
  snippet?: string;
};

export type LivePayload = {
  fetchedAt: string;
  serverTime: number | null;
  ok: boolean;
  gate: GateStatus | null;
  gateVisible: boolean;
  /** rolling half-hourly crossing times published by BRC Gate */
  toc: WaitSample[];
  /** hourly @bmantraffic travel-time posts */
  traffic: TrafficPost[];
  current: { minutes: number | null; at: string | null; source: string | null };
  forecasts: Forecast[];
  weatherText: string[];
  nws: { headline: string | null; alerts: { event: string; headline: string; severity: string }[] } | null;
  banners: BannerMessage[];
  social: SocialPost[];
  webcast: { available: boolean; playbackId: string | null } | null;
  conditions: {
    at: string; tempF: number | null; windMph: number | null; gustMph: number | null;
    windDir: number | null; visibilityM: number | null; visibilityMi: number | null;
    dust: "calm" | "dusty" | "whiteout" | "unknown";
  } | null;
  cameras: { id: string; label: string; where: string; ageSec: number | null; ok: boolean }[];
  bmir: {
    enabled: boolean;
    onAir: { dj: string; start: string; end: string } | null;
    next: { dj: string; start: string } | null;
    streamUrl: string;
  } | null;
  manBurnAt: string | null;
  /** operator switches on the official dashboard, mirrored so the page can be honest */
  flags: {
    trafficVisible: boolean;
    gateVisible: boolean;
    routeDiagramVisible: boolean;
    placeholderMode: boolean;
    trafficWindowHours: number | null;
  };
  sourceHealth: Record<string, "ok" | "empty" | "error">;
};

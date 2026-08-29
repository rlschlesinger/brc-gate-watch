export type HistCell = { day: string; hour: number; typical: number; n: number };
export type HistDay = {
  label: string; offset: number; date: string;
  typical: number; peak: number; floor: number; n: number; note?: string;
};
export type HistPhase = { days: HistDay[]; cells: HistCell[] };
export type HistYear = { label: string; note: string; arrival: HistPhase; exodus: HistPhase };

export type Historical = {
  status: "pending" | "ok";
  generatedAt: string | null;
  coverageYears: number[];
  defaultYear?: string;
  days: string[];
  years: Record<string, HistYear>;
  insights: { text: string; sourceUrl?: string | null; years?: number[] | null }[];
  sources: { title: string; url: string; year?: number }[];
  primarySource?: { title: string; url: string };
};

export type HistCell = { day: string; hour: number; typical: number | null; n: number; years?: number[] };
export type HistDay = { label: string; typical: number | null; peak: number | null; note?: string };
export type HistSource = { title: string; url: string; type?: string; year?: number };

export type Historical = {
  status: "pending" | "ok";
  generatedAt: string | null;
  coverageYears: number[];
  days: string[];
  cells: HistCell[];
  byDay: HistDay[];
  insights: { text: string; sourceUrl?: string }[];
  sources: HistSource[];
};

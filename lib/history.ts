import type { WaitSample } from "./types";
import { dedupeByAt } from "./parse";

/**
 * Persisted wait-time history.
 *
 * The official dashboard only publishes a rolling window (6h of half-hourly
 * crossing times, ~12h of @bmantraffic posts), so anything older is gone for
 * good unless something records it. Every /api/live call folds the current
 * window into a Blob-backed archive, which means the archive self-heals as long
 * as the page is loaded at least once every few hours.
 */

const KEY = "history/2026.json";

export type Archive = { updatedAt: string; samples: WaitSample[] };

const EMPTY: Archive = { updatedAt: new Date(0).toISOString(), samples: [] };

function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function readArchive(): Promise<Archive> {
  if (!hasBlob()) return EMPTY;
  try {
    const { get } = await import("@vercel/blob");
    const res = await get(KEY, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return EMPTY;
    const j = JSON.parse(await new Response(res.stream).text()) as Archive;
    return { updatedAt: j.updatedAt ?? EMPTY.updatedAt, samples: Array.isArray(j.samples) ? j.samples : [] };
  } catch {
    return EMPTY;
  }
}

export async function mergeIntoArchive(fresh: WaitSample[]): Promise<Archive> {
  const existing = await readArchive();
  const merged = dedupeByAt([...existing.samples, ...fresh]);
  if (merged.length === existing.samples.length) return existing;
  if (!hasBlob()) return { updatedAt: new Date().toISOString(), samples: merged };

  const next: Archive = { updatedAt: new Date().toISOString(), samples: merged };
  try {
    const { put } = await import("@vercel/blob");
    await put(KEY, JSON.stringify(next), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 30,
    });
  } catch {
    /* archive is best-effort; the live window still renders */
  }
  return next;
}

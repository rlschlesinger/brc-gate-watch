import { NextResponse } from "next/server";
import {
  fetchBrcFeed, fetchGateStatus, fetchWebcast, fetchNws, fetchReddit, fetchBluesky,
  fetchMastodon, fetchConditions, fetchCameraStatus, normalizeBanners, normalizeTraffic, CAMERAS,
} from "@/lib/sources";
import { mergeSamples, tocToSamples, trafficToSamples } from "@/lib/parse";
import { mergeIntoArchive } from "@/lib/history";
import type { LivePayload, SocialPost } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health: LivePayload["sourceHealth"] = {};
  const settle = async <T,>(name: string, p: Promise<T>): Promise<T | null> => {
    try {
      const v = await p;
      health[name] = "ok";
      return v;
    } catch (e) {
      health[name] = String(e).includes("empty") ? "empty" : "error";
      return null;
    }
  };

  const [feed, gate, webcast, nws, reddit, bsky, masto, conditions, cams] = await Promise.all([
    settle("brc_feed", fetchBrcFeed()),
    settle("brc_gate_status", fetchGateStatus()),
    settle("brc_webcast", fetchWebcast()),
    settle("nws", fetchNws()),
    settle("reddit", fetchReddit()),
    settle("bluesky", fetchBluesky()),
    settle("mastodon", fetchMastodon()),
    settle("open_meteo", fetchConditions()),
    settle("cameras", fetchCameraStatus()),
  ]);

  const serverTime = feed?.serverTime ?? Date.now();
  const traffic = normalizeTraffic(feed?.synced?.traffic);
  const toc = tocToSamples(feed?.synced?.toc, serverTime);
  const tweetSamples = trafficToSamples(traffic);
  const window = mergeSamples(toc, tweetSamples);

  const archive = await mergeIntoArchive(window);
  health["archive"] = archive.samples.length > 0 ? "ok" : "empty";

  const latest = window.length ? window[window.length - 1] : null;
  const social: SocialPost[] = [...(reddit ?? []), ...(bsky ?? []), ...(masto ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 24);

  const payload: LivePayload = {
    fetchedAt: new Date().toISOString(),
    serverTime: feed?.serverTime ?? null,
    ok: Boolean(feed),
    gate,
    gateVisible: Boolean(feed?.synced?.gate_status_visibility),
    toc: window,
    traffic,
    current: latest ? { minutes: latest.minutes, at: latest.at, source: latest.source } : { minutes: null, at: null, source: null },
    forecasts: feed?.synced?.weather_forecasts ?? [],
    weatherText: (feed?.synced?.weather ?? []).filter(Boolean),
    nws,
    banners: normalizeBanners(feed?.messages),
    social,
    webcast,
    conditions,
    cameras: cams ?? Object.entries(CAMERAS).map(([id, c]) => ({ id, label: c.label, where: c.where, ageSec: null, ok: false })),
    sourceHealth: health,
  };

  return NextResponse.json(
    { ...payload, archiveUpdatedAt: archive.updatedAt, archiveCount: archive.samples.length },
    { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}

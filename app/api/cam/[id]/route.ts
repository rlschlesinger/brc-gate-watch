import { CAMERAS } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxies the roadside cameras. Both hosts are fine with hotlinking, but going
 * through here means one origin for the page, a uniform staleness header, and
 * no broken-image icon when a camera goes dark.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cam = CAMERAS[id];
  if (!cam) return new Response("unknown camera", { status: 404 });

  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(`${cam.url}${cam.url.includes("?") ? "&" : "?"}t=${Date.now()}`, {
      signal: ctl.signal,
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        accept: "image/jpeg,image/*",
      },
    });
    if (!r.ok || !r.body) return new Response("camera unavailable", { status: 502 });

    const lastMod = r.headers.get("last-modified");
    const ageSec = lastMod ? Math.round((Date.now() - Date.parse(lastMod)) / 1000) : -1;

    return new Response(r.body, {
      headers: {
        "content-type": r.headers.get("content-type") ?? "image/jpeg",
        "cache-control": "public, s-maxage=45, stale-while-revalidate=120",
        "x-frame-age": String(ageSec),
        ...(lastMod ? { "x-frame-time": lastMod } : {}),
      },
    });
  } catch {
    return new Response("camera unreachable", { status: 504 });
  } finally {
    clearTimeout(t);
  }
}

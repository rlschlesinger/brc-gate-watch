import { NextResponse } from "next/server";
import { readArchive } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const archive = await readArchive();
  return NextResponse.json(archive, {
    headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}

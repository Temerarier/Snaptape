import { NextResponse } from "next/server";

// The old unauthenticated debug endpoint bypassed ownership, the paid gate
// and credits. Keep its URL unavailable; local regression scripts remain.
export async function GET() {
  return NextResponse.json({ error: "not available" }, { status: 404 });
}

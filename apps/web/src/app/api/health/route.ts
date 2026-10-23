import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let dbOk = false;
  let dbLatencyMs = 0;

  if (url && publicKey) {
    const start = Date.now();
    try {
      const supabase = createClient(url, publicKey, { auth: { persistSession: false } });
      const { error } = await supabase.from("services").select("id").limit(1);
      dbLatencyMs = Date.now() - start;
      dbOk = !error;
    } catch {
      dbOk = false;
    }
  }

  const healthy = !url || dbOk;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "web",
      uptime_seconds: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        configured: Boolean(url),
        connected: dbOk,
        latency_ms: dbLatencyMs,
      },
    },
    { status: healthy ? 200 : 503 },
  );
}

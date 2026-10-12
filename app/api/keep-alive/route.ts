import { createClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

/**
 * Supabase pauses Free plan projects after about a week without enough
 * database activity, which takes the whole site down until someone restores
 * it from the dashboard. A Vercel cron job (see vercel.json) calls this once a
 * day so quiet stretches between reads don't count as inactivity.
 *
 * Each query is a real round trip to Postgres. They run as the anonymous role,
 * so row-level security returns no rows and nothing is exposed.
 */
const TABLES = ["clubs", "reads", "books"] as const

export async function GET(request: NextRequest) {
  // Vercel sends `Authorization: Bearer $CRON_SECRET` with cron invocations.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })

  // A few separate requests rather than one, since Supabase's guidance is
  // "a few user requests to the database each day".
  for (const table of TABLES) {
    const { error } = await supabase.from(table).select("id", { count: "exact", head: true })
    if (error) {
      console.error(`[keep-alive] ${table} query failed:`, error.message)
      // A failed run shows up as an error in Vercel's cron logs.
      return Response.json({ ok: false, table, error: error.message }, { status: 503 })
    }
  }

  return Response.json({ ok: true, at: new Date().toISOString() })
}

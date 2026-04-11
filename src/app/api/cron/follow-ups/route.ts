// Cron endpoint: detect replies, then send all due follow-ups.
//
// Hit this once a day from launchd / cron / Cloudflare Workers / GitHub
// Actions / etc. It does the full daily ritual:
//   1. Pull tracker's recent emails, mark any replies as such (cancels future
//      follow-ups for those leads)
//   2. Walk all scheduled follow-ups whose dueAt has passed and send them via
//      the tracker
//
// Auth: a shared secret in the CRON_SECRET env var. Pass it as a Bearer
// token. Don't expose this without the secret — running it lets a caller
// trigger real outbound emails.

import { NextResponse } from "next/server";
import { detectRepliesAndMarkLeads, runDueFollowUps } from "@/lib/tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured = local dev convenience. Allow.
    return true;
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const startedAt = new Date().toISOString();

  let replyResult: any = null;
  let replyError: string | null = null;
  try {
    replyResult = await detectRepliesAndMarkLeads();
  } catch (e) {
    replyError = e instanceof Error ? e.message : String(e);
  }

  let followUpResult: any = null;
  let followUpError: string | null = null;
  try {
    followUpResult = await runDueFollowUps();
  } catch (e) {
    followUpError = e instanceof Error ? e.message : String(e);
  }

  const finishedAt = new Date().toISOString();

  return NextResponse.json({
    startedAt,
    finishedAt,
    replyDetection: replyResult,
    replyDetectionError: replyError,
    followUps: followUpResult,
    followUpsError: followUpError,
  });
}

// POST works too, in case something prefers it.
export const POST = GET;

// Adapter to the user's email tracker at https://email.buggers.online
// (Gmail-OAuth send + open pixel, self-built).
//
// API contract (reverse-engineered from /js/app.js):
//   POST /api/auth/login { email, password } -> { accessToken, refreshToken, user }
//   POST /api/gmail/send (multipart: to, cc, bcc, subject, body, attachments)
//        Authorization: Bearer <accessToken>
// The send endpoint requires the user's Gmail to be connected on the
// tracker side first (one-time OAuth done in the tracker UI).

import { prisma } from "./db";

const TRACKER_BASE = process.env.TRACKER_BASE_URL || "https://email.buggers.online";

// Cache the access token in module memory. The token is short-lived; on 401
// or TOKEN_EXPIRED we re-login. Good enough for a single-process app.
let cachedToken: string | null = null;

async function login(): Promise<string> {
  const email = process.env.TRACKER_EMAIL;
  const password = process.env.TRACKER_PASSWORD;
  if (!email || !password) {
    throw new Error("TRACKER_EMAIL and TRACKER_PASSWORD must be set in .env");
  }
  const res = await fetch(`${TRACKER_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`tracker login failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as { accessToken?: string };
  if (!data.accessToken) throw new Error("tracker login: no accessToken in response");
  cachedToken = data.accessToken;
  return data.accessToken;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (forceRefresh || !cachedToken) return login();
  return cachedToken;
}

async function sendViaTracker(opts: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken(attempt > 0);
    const fd = new FormData();
    fd.append("to", opts.to);
    fd.append("cc", "");
    fd.append("bcc", "");
    fd.append("subject", opts.subject);
    fd.append("body", opts.body);

    const res = await fetch(`${TRACKER_BASE}/api/gmail/send`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: fd,
    });

    if (res.ok) return { ok: true };

    // Token expired? Force a fresh login on the next pass.
    if (res.status === 401) {
      cachedToken = null;
      continue;
    }

    const txt = await res.text();
    return { ok: false, error: `tracker send ${res.status}: ${txt.slice(0, 200)}` };
  }
  return { ok: false, error: "tracker send failed after retry" };
}

export type TrackerHandoffResult =
  | { ok: true; handoffRef: string }
  | { ok: false; error: string };

export async function pushToTracker(draftId: string): Promise<TrackerHandoffResult> {
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    include: { lead: true },
  });
  if (!draft) return { ok: false, error: "draft not found" };
  if (!draft.lead.primaryEmail) return { ok: false, error: "lead has no email" };
  if (!draft.subject) return { ok: false, error: "draft has no subject" };

  const result = await sendViaTracker({
    to: draft.lead.primaryEmail,
    subject: draft.subject,
    body: draft.body,
  });

  if (!result.ok) {
    await prisma.draft.update({
      where: { id: draft.id },
      data: { status: "failed" },
    });
    return result;
  }

  // The tracker doesn't return an ID, so we mint our own reference.
  const handoffRef = `sent_${draft.id}_${Date.now()}`;
  await prisma.draft.update({
    where: { id: draft.id },
    data: {
      status: "handed_off",
      handoffRef,
      handoffAt: new Date(),
    },
  });
  await prisma.lead.update({
    where: { id: draft.leadId },
    data: { status: "handed_off" },
  });

  return { ok: true, handoffRef };
}

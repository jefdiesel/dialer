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
  const now = new Date();
  await prisma.draft.update({
    where: { id: draft.id },
    data: {
      status: "handed_off",
      handoffRef,
      handoffAt: now,
    },
  });
  await prisma.lead.update({
    where: { id: draft.leadId },
    data: { status: "handed_off" },
  });

  // Auto-schedule the next touch in the sequence. Step 0 sent → schedule
  // step 1 (day-3 bump). Step 1 sent → schedule step 2 (day-7 closeout).
  // Step 2 sent → sequence complete, do nothing.
  if (draft.step === 0) {
    const dueAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    await prisma.draft.create({
      data: {
        leadId: draft.leadId,
        channel: draft.channel,
        subject: null, // generated at send time
        body: "", // generated at send time
        status: "scheduled",
        step: 1,
        dueAt,
      },
    });
  } else if (draft.step === 1) {
    // The day-7 is 7 days after the INITIAL send, not 7 days after the bump.
    const initial = await prisma.draft.findFirst({
      where: { leadId: draft.leadId, step: 0 },
    });
    const initialSentAt = initial?.handoffAt ?? now;
    const dueAt = new Date(initialSentAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    await prisma.draft.create({
      data: {
        leadId: draft.leadId,
        channel: draft.channel,
        subject: null,
        body: "",
        status: "scheduled",
        step: 2,
        dueAt,
      },
    });
  }

  return { ok: true, handoffRef };
}

// Process all scheduled follow-ups whose dueAt has passed and whose lead
// hasn't replied. Generates the body via personalize.generateFollowUpBody,
// then sends via the tracker. Skips anything blocked.
export async function runDueFollowUps(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const { generateFollowUpBody } = await import("./personalize");
  const now = new Date();

  const dueDrafts = await prisma.draft.findMany({
    where: {
      status: "scheduled",
      dueAt: { lte: now },
    },
    include: { lead: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const draft of dueDrafts) {
    // Skip if the lead replied or was rejected/closed.
    if (draft.lead.repliedAt || draft.lead.status === "rejected") {
      await prisma.draft.update({
        where: { id: draft.id },
        data: { status: "skipped" },
      });
      skipped++;
      continue;
    }

    try {
      const step = draft.step as 1 | 2;
      const { subject, body } = await generateFollowUpBody(draft.leadId, step);

      // Save body+subject onto the draft so we have a record of what was sent.
      await prisma.draft.update({
        where: { id: draft.id },
        data: { subject, body },
      });

      const result = await sendViaTracker({
        to: draft.lead.primaryEmail!,
        subject,
        body,
      });

      if (!result.ok) {
        await prisma.draft.update({
          where: { id: draft.id },
          data: { status: "failed" },
        });
        failed++;
        continue;
      }

      const handoffRef = `sent_${draft.id}_${Date.now()}`;
      await prisma.draft.update({
        where: { id: draft.id },
        data: {
          status: "handed_off",
          handoffRef,
          handoffAt: new Date(),
        },
      });
      sent++;

      // Schedule the NEXT step if applicable. Step 1 just sent → schedule step 2.
      if (step === 1) {
        const initial = await prisma.draft.findFirst({
          where: { leadId: draft.leadId, step: 0 },
        });
        const initialSentAt = initial?.handoffAt ?? new Date();
        const dueAtNext = new Date(initialSentAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        const existingStep2 = await prisma.draft.findFirst({
          where: { leadId: draft.leadId, step: 2 },
        });
        if (!existingStep2) {
          await prisma.draft.create({
            data: {
              leadId: draft.leadId,
              channel: draft.channel,
              subject: null,
              body: "",
              status: "scheduled",
              step: 2,
              dueAt: dueAtNext,
            },
          });
        }
      }
    } catch (e) {
      console.error(`follow-up failed for draft ${draft.id}:`, e);
      await prisma.draft.update({
        where: { id: draft.id },
        data: { status: "failed" },
      });
      failed++;
    }
  }

  return { sent, skipped, failed };
}

export async function markLeadReplied(leadId: string): Promise<void> {
  const now = new Date();
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "replied", repliedAt: now },
  });
  // Cancel any future scheduled follow-ups for this lead.
  await prisma.draft.updateMany({
    where: { leadId, status: "scheduled" },
    data: { status: "skipped" },
  });
}

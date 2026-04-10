// Adapter to the user's existing email tracker (Gmail OAuth + open pixel),
// hosted on a Mac mini behind a Cloudflare tunnel.
//
// STUBBED: We don't have the tracker's API shape yet. When the user provides
// it, replace the body of `pushToTracker` with a real fetch() call. Everything
// else in the app talks to this module — no other code should know the
// tracker URL exists.

import { prisma } from "./db";
import { env } from "./env";

export type TrackerHandoffResult =
  | { ok: true; handoffRef: string }
  | { ok: false; error: string };

export async function pushToTracker(draftId: string): Promise<TrackerHandoffResult> {
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    include: { lead: true },
  });
  if (!draft) return { ok: false, error: "draft not found" };
  if (!draft.lead.primaryEmail) {
    return { ok: false, error: "lead has no email" };
  }

  // === REAL IMPLEMENTATION GOES HERE ===
  // Example shape we'd expect:
  //
  // const res = await fetch(`${env.TRACKER_BASE_URL}/api/queue`, {
  //   method: "POST",
  //   headers: {
  //     "content-type": "application/json",
  //     authorization: `Bearer ${env.TRACKER_API_KEY}`,
  //   },
  //   body: JSON.stringify({
  //     to: draft.lead.primaryEmail,
  //     subject: draft.subject,
  //     body: draft.body,
  //     externalId: draft.id,
  //   }),
  // });
  // if (!res.ok) return { ok: false, error: `tracker ${res.status}` };
  // const { id } = await res.json();
  // ======================================

  const handoffRef = `stub_${draft.id}_${Date.now()}`;
  console.log("[tracker stub] would push", {
    to: draft.lead.primaryEmail,
    subject: draft.subject,
    bodyPreview: draft.body.slice(0, 80),
    trackerBase: env.TRACKER_BASE_URL || "(not configured)",
  });

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

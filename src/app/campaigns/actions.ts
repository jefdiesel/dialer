"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { discoverLeads } from "@/lib/discover";
import { enrichCampaign } from "@/lib/enrich";
import { personalizeCampaign, personalizeLead } from "@/lib/personalize";
import { pushToTracker } from "@/lib/tracker";

export async function createCampaign(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const niche = String(formData.get("niche") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const pitch = String(formData.get("pitch") ?? "").trim();

  if (!name || !niche || !location || !pitch) {
    throw new Error("All fields required");
  }

  const c = await prisma.campaign.create({
    data: { name, niche, location, pitch },
  });
  redirect(`/campaigns/${c.id}`);
}

export async function runDiscovery(campaignId: string) {
  await discoverLeads(campaignId);
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function runEnrichment(campaignId: string) {
  await enrichCampaign(campaignId);
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function runPersonalization(campaignId: string) {
  await personalizeCampaign(campaignId);
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function regenerateDraftForLead(leadId: string) {
  // Delete existing drafts and re-run personalization for this lead.
  await prisma.draft.deleteMany({ where: { leadId } });
  await prisma.lead.update({ where: { id: leadId }, data: { status: "enriched" } });
  await personalizeLead(leadId);
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (lead) revalidatePath(`/campaigns/${lead.campaignId}`);
}

export async function approveAndPushDraft(draftId: string) {
  const result = await pushToTracker(draftId);
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    include: { lead: true },
  });
  if (draft) revalidatePath(`/campaigns/${draft.lead.campaignId}`);
  if (!result.ok) throw new Error(result.error);
}

export async function rejectLead(leadId: string) {
  await prisma.lead.update({ where: { id: leadId }, data: { status: "rejected" } });
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (lead) revalidatePath(`/campaigns/${lead.campaignId}`);
}

export async function updateDraft(draftId: string, formData: FormData) {
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  await prisma.draft.update({
    where: { id: draftId },
    data: { subject, body },
  });
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    include: { lead: true },
  });
  if (draft) revalidatePath(`/campaigns/${draft.lead.campaignId}`);
}

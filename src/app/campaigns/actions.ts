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

export async function importLeadsFromCsv(campaignId: string, formData: FormData) {
  const csv = String(formData.get("csv") ?? "").trim();
  if (!csv) throw new Error("paste some CSV first");

  // Minimal CSV parser: header row, comma-separated, quoted strings supported.
  // Recognized headers (case-insensitive, any subset): name/business,
  // website/url, email, phone, address, category.
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("need a header row + at least one data row");
  const header = rows[0].map((h) => h.trim().toLowerCase());

  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iName = idx("name", "business", "businessname", "business name");
  const iSite = idx("website", "url", "site");
  const iEmail = idx("email");
  const iPhone = idx("phone", "telephone");
  const iAddr = idx("address");
  const iCat = idx("category", "type");

  if (iName < 0) throw new Error("CSV must include a 'name' or 'business' column");

  let inserted = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const businessName = (row[iName] ?? "").trim();
    if (!businessName) continue;
    const website = iSite >= 0 ? (row[iSite] ?? "").trim() || null : null;
    const email = iEmail >= 0 ? (row[iEmail] ?? "").trim() || null : null;

    await prisma.lead.create({
      data: {
        campaignId,
        businessName,
        website,
        primaryEmail: email,
        phone: iPhone >= 0 ? (row[iPhone] ?? "").trim() || null : null,
        address: iAddr >= 0 ? (row[iAddr] ?? "").trim() || null : null,
        category: iCat >= 0 ? (row[iCat] ?? "").trim() || null : null,
        // If we already have an email from the CSV, mark as enriched so it
        // can skip discovery and go straight to personalization.
        status: email ? "enriched" : "new",
      },
    });
    inserted++;
  }
  revalidatePath(`/campaigns/${campaignId}`);
  return inserted;
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cur.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
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

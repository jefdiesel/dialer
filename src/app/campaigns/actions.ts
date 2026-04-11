"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { discoverLeads } from "@/lib/discover";
import { enrichCampaign } from "@/lib/enrich";
import { personalizeCampaign, personalizeLead } from "@/lib/personalize";
import { ADMIN_ROLE_TITLES, scrapeIndeed } from "@/lib/scrapers/indeed";
import {
  detectRepliesAndMarkLeads,
  markLeadReplied,
  pushToTracker,
  runDueFollowUps,
} from "@/lib/tracker";

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

// Indeed scrape: pulls recent job postings matching a query + city, then
// inserts one lead per unique company. The job posting itself is the intent
// signal; we store it in the enriched JSON so the personalizer can use the
// hiring post as the cold-email hook ("noticed you posted for an admin
// assistant — ~$42k loaded cost"). No owner/email yet — those get filled in
// by running the standard website enrichment pass afterward.
export async function scrapeIndeedForCampaign(campaignId: string, formData: FormData) {
  // The form passes a comma- or newline-separated list of titles. Empty
  // list = use the built-in admin role default.
  const rawTitles = String(formData.get("titles") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const maxResults = Number(formData.get("maxResults") ?? 25);
  if (!location) throw new Error("location is required");

  const titles = rawTitles
    ? rawTitles
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean)
    : ADMIN_ROLE_TITLES;

  const jobs = await scrapeIndeed({ query: titles, location, maxResults });

  // Dedupe by company name within this scrape AND against existing leads.
  const seen = new Set<string>();
  let inserted = 0;
  for (const job of jobs) {
    const key = job.companyName.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    // Skip if we already have this company in this campaign.
    const existing = await prisma.lead.findFirst({
      where: { campaignId, businessName: { equals: job.companyName } },
    });
    if (existing) continue;

    const enriched = JSON.stringify({
      source: "indeed",
      signals: ["hiring", "intent:job-posting"],
      indeed: {
        searchedTitles: titles,
        jobTitle: job.jobTitle,
        jobUrl: job.url,
        postedDaysAgo: job.postedDaysAgo,
        snippet: job.snippet,
        scrapedAt: job.scrapedAt,
      },
      textSample: job.snippet,
    });

    await prisma.lead.create({
      data: {
        campaignId,
        businessName: job.companyName,
        address: job.location || null,
        enriched,
        enrichedAt: new Date(),
        // No email yet — needs a website-enrichment pass to find it. Leaving
        // status as "new" so the enrichment button will pick it up and try
        // to locate contact info on the company website.
        status: "new",
        notes: `Indeed: hiring for "${job.jobTitle}" (${job.postedDaysAgo ?? "?"} days ago)`,
      },
    });
    inserted++;
  }

  revalidatePath(`/campaigns/${campaignId}`);
  return { found: jobs.length, inserted };
}

export async function importLeadsFromCsv(campaignId: string, formData: FormData) {
  const csv = String(formData.get("csv") ?? "").trim();
  if (!csv) throw new Error("paste some CSV first");

  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("need a header row + at least one data row");
  const header = rows[0].map((h) => h.trim().toLowerCase());

  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };

  // Minimal format: name/business, website, email, phone, address, category
  // Apollo format: company, website, email, corporate phone, first name,
  //   last name, title, # employees, industry, city, state, linkedin url
  const iName = idx("name", "business", "businessname", "business name", "company", "company name", "organization");
  const iSite = idx("website", "url", "site", "organization website", "company website");
  const iEmail = idx("email", "work email", "primary email");
  const iPhone = idx("phone", "telephone", "corporate phone", "work phone", "mobile phone");
  const iAddr = idx("address", "city");
  const iCat = idx("category", "type", "industry");
  const iFirst = idx("first name", "firstname");
  const iLast = idx("last name", "lastname");
  const iTitle = idx("title", "job title");
  const iEmployees = idx("# employees", "employees", "employee count", "headcount");
  const iCity = idx("city");
  const iState = idx("state");
  const iLinkedIn = idx("person linkedin url", "linkedin url", "linkedin");
  const iSeniority = idx("seniority");
  const iRevenue = idx("annual revenue", "revenue");

  if (iName < 0) {
    throw new Error("CSV must include a name / business / company / organization column");
  }

  // If we see Apollo-specific columns, we'll pack the extra context into the
  // enriched JSON so the personalizer can use it.
  const isApollo = iFirst >= 0 || iTitle >= 0 || iEmployees >= 0 || iLinkedIn >= 0;

  let inserted = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const businessName = (row[iName] ?? "").trim();
    if (!businessName) continue;
    const website = iSite >= 0 ? (row[iSite] ?? "").trim() || null : null;
    const email = iEmail >= 0 ? (row[iEmail] ?? "").trim() || null : null;

    // Build an owner name if we have first/last
    let ownerName: string | null = null;
    if (iFirst >= 0) {
      const first = (row[iFirst] ?? "").trim();
      const last = iLast >= 0 ? (row[iLast] ?? "").trim() : "";
      ownerName = [first, last].filter(Boolean).join(" ") || null;
    }

    // Combine city+state as the address if we don't have a full address column
    let address: string | null = null;
    if (iAddr >= 0) {
      address = (row[iAddr] ?? "").trim() || null;
    }
    if (!address && iCity >= 0) {
      const city = (row[iCity] ?? "").trim();
      const state = iState >= 0 ? (row[iState] ?? "").trim() : "";
      address = [city, state].filter(Boolean).join(", ") || null;
    }

    // Pack Apollo extras into enriched JSON so they flow to the personalizer.
    let enriched: string | null = null;
    if (isApollo) {
      const apolloContext: Record<string, string> = {};
      if (iTitle >= 0 && row[iTitle]) apolloContext.ownerTitle = row[iTitle].trim();
      if (iEmployees >= 0 && row[iEmployees]) apolloContext.employeeCount = row[iEmployees].trim();
      if (iLinkedIn >= 0 && row[iLinkedIn]) apolloContext.linkedInUrl = row[iLinkedIn].trim();
      if (iSeniority >= 0 && row[iSeniority]) apolloContext.seniority = row[iSeniority].trim();
      if (iRevenue >= 0 && row[iRevenue]) apolloContext.annualRevenue = row[iRevenue].trim();
      enriched = JSON.stringify({
        source: "apollo",
        signals: [],
        apollo: apolloContext,
        textSample: "",
      });
    }

    await prisma.lead.create({
      data: {
        campaignId,
        businessName,
        website,
        primaryEmail: email,
        ownerName,
        phone: iPhone >= 0 ? (row[iPhone] ?? "").trim() || null : null,
        address,
        category: iCat >= 0 ? (row[iCat] ?? "").trim() || null : null,
        enriched,
        enrichedAt: isApollo ? new Date() : null,
        // If we already have an email, skip discovery/enrichment and go
        // straight to drafting.
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

export async function markRepliedAction(leadId: string) {
  await markLeadReplied(leadId);
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (lead) revalidatePath(`/campaigns/${lead.campaignId}`);
}

export async function runDueFollowUpsAction(campaignId: string) {
  await runDueFollowUps();
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function detectRepliesAction(campaignId: string) {
  await detectRepliesAndMarkLeads();
  revalidatePath(`/campaigns/${campaignId}`);
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

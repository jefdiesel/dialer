// Website enrichment: fetch homepage + contact/about pages, extract emails,
// owner names, and AI-fit signals. Cheap heuristics — no LLM here.
//
// Run after discovery, before personalization.

import { prisma } from "./db";

const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
// junk we don't want to treat as the business email
const JUNK_EMAIL_RE = /(sentry|wixpress|example|noreply|no-reply|godaddy|squarespace)/i;

const SIGNAL_KEYWORDS: Record<string, RegExp> = {
  booking: /\b(book\s*(an?\s*)?appointment|schedule\s*(a\s*)?(call|visit|consult)|reserve|reservation)\b/i,
  hiring: /\b(we'?re\s*hiring|join\s*our\s*team|careers|now\s*hiring|open\s*positions)\b/i,
  manualForms: /\b(download\s*(our|the|this)?\s*form|fill\s*out|print\s*and|fax)\b/i,
  reviews: /\b(google\s*reviews?|trustpilot|yelp|testimonials)\b/i,
  ecommerce: /\b(add\s*to\s*cart|checkout|shop\s*now)\b/i,
  oldStack: /\b(jquery|wordpress|wp-content|drupal)\b/i,
  noChat: /(?!.*\b(intercom|drift|tidio|crisp|tawk|hubspot.*chat)\b)/i, // negation marker only
};

const CANDIDATE_PATHS = ["", "/contact", "/contact-us", "/about", "/about-us"];

async function fetchSafe(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; DialerBot/0.1)" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    const text = await res.text();
    return text.slice(0, 200_000); // cap
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function pickBestEmail(emails: string[]): string | undefined {
  const cleaned = Array.from(new Set(emails.map((e) => e.toLowerCase())))
    .filter((e) => !JUNK_EMAIL_RE.test(e))
    .filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e));
  // prefer info@/contact@/hello@ over generic, then anything
  const priority = ["info@", "contact@", "hello@", "office@", "owner@"];
  for (const p of priority) {
    const hit = cleaned.find((e) => e.startsWith(p));
    if (hit) return hit;
  }
  return cleaned[0];
}

export type EnrichmentResult = {
  primaryEmail?: string;
  signals: string[];
  pagesFetched: string[];
  textSample: string;
  fitScore: number;
};

export async function enrichWebsite(rawUrl: string): Promise<EnrichmentResult> {
  const base = rawUrl.replace(/\/+$/, "");
  const pagesFetched: string[] = [];
  const allEmails: string[] = [];
  let combinedText = "";

  for (const path of CANDIDATE_PATHS) {
    const url = base + path;
    const html = await fetchSafe(url);
    if (!html) continue;
    pagesFetched.push(url);
    const matches = html.match(EMAIL_RE);
    if (matches) allEmails.push(...matches);
    combinedText += " " + stripHtml(html);
    if (combinedText.length > 30_000) break;
  }

  const signals: string[] = [];
  if (SIGNAL_KEYWORDS.booking.test(combinedText)) signals.push("booking");
  if (SIGNAL_KEYWORDS.hiring.test(combinedText)) signals.push("hiring");
  if (SIGNAL_KEYWORDS.manualForms.test(combinedText)) signals.push("manualForms");
  if (SIGNAL_KEYWORDS.reviews.test(combinedText)) signals.push("reviews");
  if (SIGNAL_KEYWORDS.ecommerce.test(combinedText)) signals.push("ecommerce");
  if (SIGNAL_KEYWORDS.oldStack.test(combinedText)) signals.push("oldStack");
  if (!/\b(intercom|drift|tidio|crisp|tawk|hubspot)\b/i.test(combinedText)) {
    signals.push("noChat");
  }

  // Crude fit score: more signals = better candidate for AI consult.
  const fitScore = Math.min(100, signals.length * 15 + (allEmails.length ? 10 : 0));

  return {
    primaryEmail: pickBestEmail(allEmails),
    signals,
    pagesFetched,
    textSample: combinedText.slice(0, 4000),
    fitScore,
  };
}

export async function enrichLead(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error(`lead ${leadId} not found`);
  if (!lead.website) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "failed", notes: "no website" },
    });
    return;
  }

  const result = await enrichWebsite(lead.website);
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      enrichedAt: new Date(),
      primaryEmail: result.primaryEmail ?? null,
      enriched: JSON.stringify({
        signals: result.signals,
        pagesFetched: result.pagesFetched,
        textSample: result.textSample,
      }),
      fitScore: result.fitScore,
      status: "enriched",
    },
  });
}

export async function enrichCampaign(campaignId: string): Promise<{ ok: number; failed: number }> {
  const leads = await prisma.lead.findMany({
    where: { campaignId, status: "new" },
  });
  let ok = 0;
  let failed = 0;
  // Sequential to be polite to target sites; can parallelize later.
  for (const lead of leads) {
    try {
      await enrichLead(lead.id);
      ok++;
    } catch (e) {
      failed++;
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "failed", notes: e instanceof Error ? e.message : String(e) },
      });
    }
  }
  return { ok, failed };
}

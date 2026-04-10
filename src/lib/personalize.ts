// Personalization: takes an enriched lead + a campaign pitch and produces
// a subject line + 1-paragraph cold email pitching the AI consult.
//
// Uses Claude Sonnet 4.6 — capable enough for cold-email copy, much cheaper
// than Opus for bulk runs.

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { env } from "./env";

const MODEL = "claude-sonnet-4-6";

function client() {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

const SYSTEM = `You write cold outreach emails for an AI consultant who sells $200/hr engagements to small and mid-sized businesses.

RULES:
- Output ONLY a JSON object: {"subject": "...", "body": "..."}. No prose, no code fences.
- Subject: max 60 chars, lowercase-friendly, NOT clickbait, NOT salesy. Reference something specific from the business.
- Body: 3-5 short sentences, ~80 words max. Plain text. No greeting beyond "Hi {firstName}," (or "Hi there," if no name). No signature — that gets appended later.
- Open with one specific observation about THEIR business pulled from the context (not "I noticed your website" — name the actual thing).
- One sentence connecting that observation to a concrete way AI could help them (be specific: "automate intake forms", "draft replies to Google reviews", etc.). Avoid buzzwords like "leverage", "synergy", "transform".
- One sentence with the soft ask: a 30-min paid consult at $200/hr to scope it out. Make the price visible — it filters tire-kickers.
- NEVER fabricate facts. If the context is thin, keep the observation generic but honest ("your booking page asks people to call to schedule...").
- Sound like a human writing one email, not a template.`;

export type PersonalizedDraft = {
  subject: string;
  body: string;
};

type LeadForPersonalization = {
  businessName: string;
  category: string | null;
  website: string | null;
  ownerName: string | null;
  enriched: string | null;
};

export async function generateDraft(
  lead: LeadForPersonalization,
  pitch: string,
): Promise<PersonalizedDraft> {
  const enrichedParsed = lead.enriched ? safeJson(lead.enriched) : null;
  const signals: string[] = enrichedParsed?.signals ?? [];
  const sample: string = enrichedParsed?.textSample ?? "";

  const userMsg = `CAMPAIGN PITCH (the consultant's framing — adapt, don't copy):
${pitch}

LEAD:
- Business: ${lead.businessName}
- Category: ${lead.category ?? "unknown"}
- Website: ${lead.website ?? "none"}
- Owner first name: ${lead.ownerName ?? "(unknown — use 'Hi there,')"}
- Detected signals: ${signals.join(", ") || "none"}

WEBSITE TEXT SAMPLE (truncated, may be messy):
${sample.slice(0, 2500)}

Now write the JSON.`;

  const c = client();
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = safeJson(text);
  if (!parsed?.subject || !parsed?.body) {
    throw new Error(`personalization returned malformed JSON: ${text.slice(0, 200)}`);
  }
  return { subject: String(parsed.subject), body: String(parsed.body) };
}

function safeJson(s: string): any {
  // Strip code fences if the model added them despite instructions.
  const cleaned = s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to extracting the first { ... } block.
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

export async function personalizeLead(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { campaign: true },
  });
  if (!lead) throw new Error(`lead ${leadId} not found`);
  if (lead.status !== "enriched") {
    throw new Error(`lead ${leadId} is ${lead.status}, must be enriched first`);
  }

  const draft = await generateDraft(lead, lead.campaign.pitch);

  await prisma.draft.create({
    data: {
      leadId: lead.id,
      channel: "email",
      subject: draft.subject,
      body: draft.body,
      model: MODEL,
      status: "draft",
    },
  });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "drafted" },
  });
}

export async function personalizeCampaign(campaignId: string): Promise<{ ok: number; failed: number }> {
  const leads = await prisma.lead.findMany({
    where: { campaignId, status: "enriched" },
  });
  let ok = 0;
  let failed = 0;
  for (const lead of leads) {
    try {
      await personalizeLead(lead.id);
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

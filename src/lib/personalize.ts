// Personalization via the local `claude` CLI (Claude Code), so it runs on the
// user's Max subscription instead of API credits. We pipe the prompt over
// stdin and parse the streamed JSON envelope.
//
// Why CLI and not the SDK: the Anthropic SDK only authenticates with an API
// key. The Claude Code CLI authenticates via OAuth/keychain (the Max plan).

import { prisma } from "./db";
import { runClaude, safeJsonExtract } from "./claudeCli";

const MODEL = "sonnet"; // sonnet 4.6, fast + cheap on quota

const SYSTEM = `You write cold outreach emails for an AI consultant who sells $200/hr engagements to small and mid-sized businesses.

CRITICAL FRAMING — TEASE, DON'T TELL:
The actual industry-specific AI recommendations are the consultant's PAID DELIVERABLE. The email exists to bait a paid consult, NOT to give away advice. Demonstrate that the consultant has specific ideas for THIS industry without revealing what they are. The recipient should think "this person knows my world" — not "great, now I know what to do."

RULES:
- Output ONLY a JSON object: {"subject": "...", "body": "..."}. No prose, no code fences, no preamble.
- Subject: max 60 chars, NOT clickbait, NOT salesy. Reference something specific from the business.
- Body: 3-5 short sentences, ~80 words max. Plain text. Greeting "Hi {firstName}," or "Hi there," if no name. No signature — that gets appended later.
- Open with ONE specific observation about THEIR business pulled from the context (not "I noticed your website" — name the actual thing).
- ONE sentence hinting that the consultant has worked with their industry and has specific ideas. NEVER list use cases. NEVER name AI capabilities ("OCR", "automation", "RAG"). NEVER say "we could do X". Phrases like "a few things specific to {their industry} I'd want to walk through" are right; "we could automate your intake forms" is WRONG — that gives the answer away.
- ONE sentence with the soft ask: a paid 30-min consult at $200/hr. Make the price visible — it filters tire-kickers.
- Avoid buzzwords ("leverage", "synergy", "transform").
- NEVER fabricate facts. If the context is thin, keep the observation generic but honest.
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
  playbookContext?: PlaybookContext,
): Promise<PersonalizedDraft> {
  const enrichedParsed = lead.enriched ? safeJsonExtract(lead.enriched) : null;
  const signals: string[] = enrichedParsed?.signals ?? [];
  const sample: string = enrichedParsed?.textSample ?? "";
  const apollo = enrichedParsed?.apollo as
    | {
        ownerTitle?: string;
        employeeCount?: string;
        linkedInUrl?: string;
        seniority?: string;
        annualRevenue?: string;
      }
    | undefined;

  const playbookBlock = playbookContext
    ? `

INDUSTRY CONTEXT (for targeting only — DO NOT mention or paraphrase any of this in the email):
- Industry: ${playbookContext.name}
- Why this lead is a fit: ${playbookContext.summary}
- The consultant has a researched playbook on this industry (the paid deliverable). Your job is to make the email sound industry-aware without naming any of the contents. Phrases like "a few things specific to ${playbookContext.name.toLowerCase()} I'd want to walk through" are right.
`
    : "";

  const apolloBlock = apollo
    ? `
APOLLO CONTEXT (from a lead database — use these facts to make the email specific):
${apollo.ownerTitle ? `- Owner title: ${apollo.ownerTitle}\n` : ""}${apollo.employeeCount ? `- Employee count: ${apollo.employeeCount}\n` : ""}${apollo.annualRevenue ? `- Annual revenue: ${apollo.annualRevenue}\n` : ""}${apollo.seniority ? `- Seniority: ${apollo.seniority}\n` : ""}`
    : "";

  const userMsg = `CAMPAIGN PITCH (the consultant's framing — adapt, don't copy):
${pitch}
${playbookBlock}${apolloBlock}
LEAD:
- Business: ${lead.businessName}
- Category: ${lead.category ?? "unknown"}
- Website: ${lead.website ?? "none"}
- Owner first name: ${lead.ownerName ?? "(unknown — use 'Hi there,')"}
- Detected signals: ${signals.join(", ") || "none"}

WEBSITE TEXT SAMPLE (truncated, may be messy):
${sample.slice(0, 2500)}

Now write the JSON.`;

  const text = await runClaude({
    systemPrompt: SYSTEM,
    userPrompt: userMsg,
    model: MODEL,
  });
  const parsed = safeJsonExtract(text);
  if (!parsed?.subject || !parsed?.body) {
    throw new Error(`personalization returned malformed JSON: ${text.slice(0, 200)}`);
  }
  return { subject: String(parsed.subject), body: String(parsed.body) };
}

export type PlaybookContext = {
  name: string;
  summary: string;
};

// Fuzzy lookup: turn the campaign niche into a slug and try exact match first,
// then a contains match. Only published playbooks affect outreach.
async function findPlaybookForNiche(niche: string) {
  const slug = niche
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const exact = await prisma.playbook.findFirst({
    where: { industrySlug: slug, status: "published" },
  });
  if (exact) return exact;

  // Try a "contains" match in either direction so "dental clinics" matches
  // a published "dental" playbook and vice versa.
  const all = await prisma.playbook.findMany({ where: { status: "published" } });
  return (
    all.find((p) => slug.includes(p.industrySlug) || p.industrySlug.includes(slug)) ??
    null
  );
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

  const playbook = await findPlaybookForNiche(lead.campaign.niche);
  const playbookContext: PlaybookContext | undefined = playbook
    ? { name: playbook.name, summary: playbook.summary }
    : undefined;

  const draft = await generateDraft(lead, lead.campaign.pitch, playbookContext);

  await prisma.draft.create({
    data: {
      leadId: lead.id,
      channel: "email",
      subject: draft.subject,
      body: draft.body,
      model: `cli:${MODEL}`,
      status: "draft",
    },
  });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "drafted" },
  });
}

export async function personalizeCampaign(
  campaignId: string,
): Promise<{ ok: number; failed: number }> {
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

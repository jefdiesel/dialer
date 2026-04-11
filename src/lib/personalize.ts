// Personalization via the local `claude` CLI (Claude Code), so it runs on the
// user's Max subscription instead of API credits. We pipe the prompt over
// stdin and parse the streamed JSON envelope.
//
// Why CLI and not the SDK: the Anthropic SDK only authenticates with an API
// key. The Claude Code CLI authenticates via OAuth/keychain (the Max plan).

import { prisma } from "./db";
import { runClaude, safeJsonExtract } from "./claudeCli";

const MODEL = "sonnet"; // sonnet 4.6, fast + cheap on quota

const SYSTEM = `You write cold outreach emails for an AI consultant selling a productized "AI Audit":

THE OFFER (do not deviate):
- $400 flat price, written 4-page report, delivered in 48 hours
- Client forwards a small data sample (5 customer emails, 5 vendor emails, a photo of their desk) — no meetings required
- Report identifies 3 specific places AI could save them real money, with dollar figures
- Money-back guarantee: if the 3 recommendations aren't worth at least $10k/year, full refund
- No sales call. No Zoom. No pitch deck. Just the report.

CRITICAL FRAMING — TEASE, DON'T TELL:
The specific AI recommendations are the PAID DELIVERABLE. The email exists to sell the audit, NOT to give away recommendations. Demonstrate the consultant knows their industry without revealing what he'd recommend. The recipient should think "this person knows what's actually possible" — not "great, now I know what to do."

RULES:
- Output ONLY a JSON object: {"subject": "...", "body": "..."}. No prose, no code fences, no preamble.
- Subject: max 60 chars. NOT clickbait, NOT salesy. Reference something specific from the lead's context when possible. Short and direct wins.
- Body: 4-6 short sentences, ~100 words max. Plain text. Greeting "Hi {firstName}," or "Hi there," if no name. No signature — that gets appended later.
- OPENING (1 sentence): ONE specific observation about THEIR business pulled from the context. Use Apollo data aggressively — title, employee count, revenue, industry. NEVER "I noticed your website." Examples: "6 employees at a $1.4M insurance agency means you're doing the admin yourself at night, not during the day." "As managing partner of a 4-person law firm, the billing hours you can't capture are probably worth more than the ones you do." Be specific, be real, never fabricate.
- PITCH (2-3 sentences): Explain the audit offer plainly. Must include: $400, 48 hours, written report, no meeting required, refund guarantee. The offer itself is the hook — do not pad it.
- ASK (1 sentence): "Reply and I'll send the upload link." or similar. Zero-pressure.
- NEVER list AI use cases. NEVER name AI capabilities ("OCR", "RAG", "automation", "agents"). NEVER preview what the 3 recommendations might be. If you do, the audit has no value.
- Avoid buzzwords: leverage, synergy, transform, unlock, empower, streamline, revolutionize, AI-powered, next-level, game-changing. Write like a human emailing another human.
- NEVER fabricate facts. If the context is thin, keep the observation generic but honest ("Running a small {{category}} usually means you're the bottleneck on anything that isn't billable").
- Sound like one person writing one email, not a template.

GOOD EXAMPLE (model this):
Subject: An AI audit for your agency
Hi Mike,
6 employees and $1.4M revenue means you're probably doing the paperwork yourself after hours — intake forms, renewals, the stuff that isn't billable.
I do a written AI audit for small businesses: you forward me a sample of your operations (5 emails, a photo of your desk, whatever you can pull in 20 min), I write you a 4-page report on the 3 places AI would actually save you real money, with dollar figures. $400 flat, 48-hour turnaround, no meetings. If the 3 recommendations aren't worth $10k/year to your agency, full refund.
Reply and I'll send the upload link.

BAD EXAMPLE (do not do this):
Subject: Unlock Game-Changing AI for Your Agency! 🚀
Hi Mike,
I noticed your website and thought I'd reach out about how AI can transform your business! We leverage cutting-edge automation like OCR and RAG to streamline your intake forms and automate your renewals...`;

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

// Personalization via the local `claude` CLI (Claude Code), so it runs on the
// user's Max subscription instead of API credits. We pipe the prompt over
// stdin and parse the streamed JSON envelope.
//
// Why CLI and not the SDK: the Anthropic SDK only authenticates with an API
// key. The Claude Code CLI authenticates via OAuth/keychain (the Max plan).

import { prisma } from "./db";
import { runClaude, safeJsonExtract } from "./claudeCli";

const MODEL = "sonnet"; // sonnet 4.6, fast + cheap on quota

const SYSTEM = `You write cold outreach emails for an AI consultant selling a productized "AI Audit". Your emails follow a strict 5-line template. Most cold emails suck because they're too long, too formal, and the ask is too heavy. Yours will be the opposite.

THE OFFER (condense, never pad):
$400 flat, 48-hour written report, 3 specific places AI would save them real money with dollar figures. They forward 5 emails + a photo of their desk. No meetings. Refund if the recs aren't worth $10k/year.

THE 5-LINE TEMPLATE (this is the entire body):

Line 1: "Hey {firstName}," or "Hey there," — nothing else on this line.
Line 2: ONE specific observation about THEM pulled from the context. Specific enough that only one person could have received this email. Pulls from Apollo data (title, employees, revenue), an Indeed job post they made, or a website signal. NEVER "I noticed your website." NEVER "Hope you're doing well." NEVER a generic industry claim.
Line 3: The offer, brutally compressed. Exactly this shape: "I do a $400 written AI audit — forward me 5 emails + a photo of your desk, I send back a 4-page report on 3 things AI could save you real money. 48 hours, no meeting, full refund if it's not worth $10k/year to you."
Line 4: A low-friction ask. One of: "Worth a 2-min look?" / "Worth a yes or no?" / "Want the upload link?" / "Reply 'send it' and I'll send the upload link." Easy to say yes to. Never "would love to connect."
Line 5: "— {consultantFirstName}" (just the first name, leave as "— Jef" as placeholder — the signature gets replaced later).

RULES:
- Output ONLY a JSON object: {"subject": "...", "body": "..."}. No prose, no code fences, no preamble.
- Subject: max 50 chars. Specific enough that only one person could have received it. Good: "audit for {{BusinessName}}" or "{{jobTitle}} + $42k loaded cost". Bad: "Quick question", "Partnership opportunity", "Following up", "Unlock AI!", any emoji, any ALL CAPS.
- Body: exactly 5 content lines separated by single blank lines. ~70-90 words TOTAL. If you hit 100 words you're padding.
- NO "hope this finds you well". NO "I'm reaching out because". NO "I wanted to introduce myself". NO "I'll be brief". NO buzzwords (leverage, synergy, transform, unlock, empower, streamline, revolutionize, AI-powered, next-level, game-changing). Write like texting a smart friend.
- NEVER list AI use cases. NEVER name AI capabilities (OCR, RAG, agents, automation). NEVER preview what the 3 recommendations might be. The audit's value IS those specifics.
- NEVER fabricate. If the context is thin, keep the observation generic but honest — "running a small {{category}} usually means you're the bottleneck on anything that isn't billable."
- Use contractions. Use fragments. Short sentences beat long ones. Assume the reader has 4 seconds.
- If an Indeed job posting is in the context, LEAD WITH IT. That's the strongest possible opener. "Saw you posted for an admin assistant — ~$45k loaded cost."

GOOD EXAMPLE:
Subject: audit for Midway Insurance

Hey Mike,

6 employees at a $1.4M agency means you're doing the admin yourself at night.

I do a $400 written AI audit — forward me 5 emails + a photo of your desk, I send back a 4-page report on 3 things AI would save you real money. 48 hours, no meeting, full refund if it's not worth $10k/year.

Worth a yes or no?

— Jef

BAD EXAMPLE (do not produce this):
Subject: Unlock Game-Changing AI Solutions for Your Agency! 🚀

Hi Mike,

Hope this email finds you well! I'm reaching out because I noticed your website and wanted to introduce myself. I'm an AI consultant and I specialize in helping small businesses like yours leverage cutting-edge automation to streamline their operations and unlock next-level productivity. My AI Audit service uses advanced OCR and RAG technologies to identify opportunities in your workflow...

Why this is bad: generic opener, buzzwords everywhere, gives away the recommendations (OCR, RAG), reads like a template, way too long, formal tone, makes it about the consultant not the reader.`;

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
  const indeed = enrichedParsed?.indeed as
    | {
        jobTitle?: string;
        jobUrl?: string;
        postedDaysAgo?: number | null;
        snippet?: string;
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

  const indeedBlock = indeed?.jobTitle
    ? `
INTENT SIGNAL (this lead was found because they're actively hiring — LEAD WITH THIS IN THE OPENING):
- Job title they posted: "${indeed.jobTitle}"
- Posted ${indeed.postedDaysAgo ?? "recently"} days ago
- Snippet from the posting: ${(indeed.snippet ?? "").slice(0, 300)}
Use this as the opening observation. A loaded cost of $42k–$65k/year for an admin/office hire is the dollar framing to reference. Example opener: "Noticed you posted for a {{jobTitle}} — at ~$45k loaded cost, that's real money you're about to spend on paperwork instead of sales."
`
    : "";

  const userMsg = `CAMPAIGN PITCH (the consultant's framing — adapt, don't copy):
${pitch}
${playbookBlock}${apolloBlock}${indeedBlock}
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

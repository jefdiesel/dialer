// Personalization via the local `claude` CLI (Claude Code), so it runs on the
// user's Max subscription instead of API credits. We pipe the prompt over
// stdin and parse the streamed JSON envelope.
//
// Why CLI and not the SDK: the Anthropic SDK only authenticates with an API
// key. The Claude Code CLI authenticates via OAuth/keychain (the Max plan).

import { spawn } from "node:child_process";
import { prisma } from "./db";

const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const MODEL = "sonnet"; // sonnet 4.6, fast + cheap on quota

const SYSTEM = `You write cold outreach emails for an AI consultant who sells $200/hr engagements to small and mid-sized businesses.

RULES:
- Output ONLY a JSON object: {"subject": "...", "body": "..."}. No prose, no code fences, no preamble.
- Subject: max 60 chars, NOT clickbait, NOT salesy. Reference something specific from the business.
- Body: 3-5 short sentences, ~80 words max. Plain text. Greeting "Hi {firstName}," or "Hi there," if no name. No signature — that gets appended later.
- Open with one specific observation about THEIR business pulled from the context (not "I noticed your website" — name the actual thing).
- One sentence connecting that observation to a concrete way AI could help them (e.g. "automate intake forms", "draft replies to Google reviews"). Avoid buzzwords like "leverage", "synergy", "transform".
- One sentence with the soft ask: a 30-min paid consult at $200/hr to scope it out. Make the price visible — it filters tire-kickers.
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

function callClaude(userPrompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Strip ANTHROPIC_API_KEY from the child env so the CLI is forced to use
    // the Max sub OAuth credentials (matches the user's shell alias).
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_BASE_URL;

    const child = spawn(
      CLAUDE_BIN,
      [
        "-p",
        "--model",
        MODEL,
        "--output-format",
        "json",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--system-prompt",
        SYSTEM,
      ],
      { env, stdio: ["pipe", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString()));
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`claude CLI exit ${code}: ${stderr.slice(0, 300)}`));
        return;
      }
      try {
        // The CLI emits a JSON array of events; the final {type:"result"} event
        // has a `result` field with the assistant's text.
        const events = JSON.parse(stdout);
        if (!Array.isArray(events)) {
          reject(new Error(`unexpected CLI output: ${stdout.slice(0, 200)}`));
          return;
        }
        const finalEvent = events.find(
          (e: any) => e?.type === "result" && typeof e.result === "string",
        );
        if (!finalEvent) {
          reject(new Error(`no result event in CLI output: ${stdout.slice(0, 200)}`));
          return;
        }
        resolve(finalEvent.result as string);
      } catch (e) {
        reject(new Error(`failed to parse CLI output: ${(e as Error).message}`));
      }
    });

    child.stdin.write(userPrompt);
    child.stdin.end();
  });
}

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

  const text = await callClaude(userMsg);
  const parsed = safeJson(text);
  if (!parsed?.subject || !parsed?.body) {
    throw new Error(`personalization returned malformed JSON: ${text.slice(0, 200)}`);
  }
  return { subject: String(parsed.subject), body: String(parsed.body) };
}

function safeJson(s: string): any {
  const cleaned = s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
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

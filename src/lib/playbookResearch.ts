// Generate a research-backed industry playbook by shelling out to the local
// `claude` CLI with WebSearch + WebFetch enabled. The playbook is the
// CONSULTANT'S PAID DELIVERABLE — substantial, ranked use cases, presentable
// during a $200/hr call.
//
// Output shape: { industrySlug, name, summary, markdown, top3UseCases, citations }

import { prisma } from "./db";
import { runClaude, safeJsonExtract } from "./claudeCli";

const MODEL = "sonnet";
const RESEARCH_TIMEOUT_MS = 5 * 60 * 1000;

const SYSTEM = `You are a senior AI consultant researching how AI can help a specific industry. You produce a single playbook document that the consultant will use as the deliverable in a paid $200/hr engagement. It must be substantive, specific, and grounded in real sources.

You have WebSearch and WebFetch tools. USE THEM. Search for:
- How this industry currently operates and where the friction is
- What AI tools / vendors are already pitching this industry
- Real case studies, ROI numbers, and gotchas
- Regulatory or compliance constraints that limit AI use

OUTPUT FORMAT — return ONLY a single JSON object, no prose, no code fences:

{
  "industrySlug": "kebab-case-slug",
  "name": "Human Readable Name",
  "summary": "1-2 sentences describing this industry's typical AI fit and where the value is",
  "markdown": "# Full playbook in Markdown.\\n\\n10-20 ranked use cases. Each section: ## N. Use case title\\n**Pain point**: ...\\n**What AI does**: ...\\n**Effort**: low/medium/high\\n**Typical ROI**: ...\\n**Gotchas**: ...\\n**Example**: ...\\n\\nClose with a 'Where to start' section recommending 2-3 quick wins.",
  "top3UseCases": [
    {"title": "...", "painPoint": "...", "capability": "..."},
    {"title": "...", "painPoint": "...", "capability": "..."},
    {"title": "...", "painPoint": "...", "capability": "..."}
  ],
  "citations": [
    {"title": "page or article title", "url": "https://...", "quote": "the specific fact or claim you used"}
  ]
}

RULES:
- Minimum 10 use cases in the markdown, ranked by ROI per dollar of effort.
- Be honest about limits and risks. If AI is a bad fit somewhere, say so.
- Cite at least 5 real sources you actually fetched. NEVER fabricate URLs.
- The markdown is what the consultant will paste into a Google Doc and walk a client through. Make it useful as-is.
- The top3UseCases is what feeds outreach — pick the three most attention-grabbing for cold emails.
- Output MUST be valid JSON. Strings with newlines must use \\n. Do not wrap in code fences.`;

export type PlaybookResearchResult = {
  industrySlug: string;
  name: string;
  summary: string;
  markdown: string;
  top3UseCases: Array<{ title: string; painPoint: string; capability: string }>;
  citations: Array<{ title: string; url: string; quote: string }>;
};

export async function researchPlaybook(industry: string): Promise<{
  data: PlaybookResearchResult;
  transcript: string;
}> {
  const userPrompt = `Research and write the AI playbook for the following industry: ${industry}

Use WebSearch and WebFetch heavily. Take your time. Aim for 12-15 ranked use cases. Cite real sources. Then return the JSON.`;

  const transcript = await runClaude({
    systemPrompt: SYSTEM,
    userPrompt,
    model: MODEL,
    tools: ["WebSearch", "WebFetch"],
    bypassPermissions: true,
    timeoutMs: RESEARCH_TIMEOUT_MS,
  });

  const parsed = safeJsonExtract(transcript);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`research returned non-JSON: ${transcript.slice(0, 300)}`);
  }
  if (!parsed.industrySlug || !parsed.name || !parsed.markdown) {
    throw new Error(
      `research JSON missing required fields. Got keys: ${Object.keys(parsed).join(", ")}`,
    );
  }
  return { data: parsed as PlaybookResearchResult, transcript };
}

export async function createPlaybookFromResearch(industry: string): Promise<string> {
  const { data, transcript } = await researchPlaybook(industry);

  // Upsert by slug so re-researching the same industry overwrites the draft
  // instead of creating duplicates.
  const existing = await prisma.playbook.findUnique({
    where: { industrySlug: data.industrySlug },
  });

  const payload = {
    industrySlug: data.industrySlug,
    name: data.name,
    summary: data.summary,
    markdown: data.markdown,
    top3UseCases: JSON.stringify(data.top3UseCases ?? []),
    citations: JSON.stringify(data.citations ?? []),
    researchTranscript: transcript,
    model: MODEL,
    // Always land in 'draft' — published is a manual step.
    status: existing?.status === "published" ? "published" : "draft",
  };

  const saved = existing
    ? await prisma.playbook.update({ where: { id: existing.id }, data: payload })
    : await prisma.playbook.create({ data: payload });

  return saved.id;
}

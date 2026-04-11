// Bulk-import every /tmp/research_*.json into the Playbook table as drafts.
// Idempotent: re-running updates by industrySlug instead of duplicating.

import { readFileSync, readdirSync } from "node:fs";
import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";

const files = readdirSync("/tmp")
  .filter((f) => f.startsWith("research_") && f.endsWith(".json"))
  .map((f) => `/tmp/${f}`);

if (files.length === 0) {
  console.error("no /tmp/research_*.json files found");
  process.exit(1);
}

const db = new Database("./dev.db");

const upsert = db.transaction((pb, transcript) => {
  const existing = db
    .prepare("SELECT id FROM Playbook WHERE industrySlug = ?")
    .get(pb.industrySlug);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare(
      `UPDATE Playbook SET name=?, summary=?, markdown=?, top3UseCases=?, citations=?, researchTranscript=?, model=?, updatedAt=? WHERE id=?`,
    ).run(
      pb.name,
      pb.summary,
      pb.markdown,
      JSON.stringify(pb.top3UseCases ?? []),
      JSON.stringify(pb.citations ?? []),
      transcript,
      "sonnet",
      now,
      existing.id,
    );
    return { id: existing.id, action: "updated" };
  }
  const id = "c" + randomBytes(12).toString("base64url").slice(0, 24);
  db.prepare(
    `INSERT INTO Playbook (id, industrySlug, name, summary, markdown, top3UseCases, citations, researchTranscript, model, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    pb.industrySlug,
    pb.name,
    pb.summary,
    pb.markdown,
    JSON.stringify(pb.top3UseCases ?? []),
    JSON.stringify(pb.citations ?? []),
    transcript,
    "sonnet",
    "draft",
    now,
    now,
  );
  return { id, action: "inserted" };
});

let ok = 0;
let fail = 0;

for (const file of files) {
  const slug = file.replace("/tmp/research_", "").replace(".json", "");
  try {
    const raw = readFileSync(file, "utf8");
    const firstLine = raw.split("\n")[0];
    const events = JSON.parse(firstLine);
    const result = events.find((e) => e.type === "result");
    if (!result || result.is_error) {
      throw new Error(`no successful result event (is_error=${result?.is_error})`);
    }
    const text = result.result;
    // Extract the largest {...} block (handles ```json fences + preamble)
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no JSON object in result");
    const pb = JSON.parse(m[0]);
    if (!pb.industrySlug || !pb.name || !pb.markdown) {
      throw new Error(`missing required fields. keys: ${Object.keys(pb).join(",")}`);
    }
    const r = upsert(pb, text);
    console.log(
      `[${slug}] ${r.action} ${r.id}  md=${pb.markdown.length}c  cites=${(pb.citations ?? []).length}  http://localhost:3000/playbooks/${r.id}`,
    );
    ok++;
  } catch (e) {
    console.error(`[${slug}] FAILED: ${e.message}`);
    fail++;
  }
}

db.close();
console.log(`\ndone: ${ok} ok, ${fail} failed`);

// One-shot: parse the test research output and insert into the Playbook
// table via raw better-sqlite3 (bypasses Prisma client ESM resolution).

import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";

const raw = readFileSync("/tmp/research_out.json", "utf8");
const events = JSON.parse(raw.split("\n")[0]);
const result = events.find((e) => e.type === "result");
if (!result) throw new Error("no result event");
const m = result.result.match(/\{[\s\S]*\}/);
if (!m) throw new Error("no JSON object in result");
const pb = JSON.parse(m[0]);

const db = new Database("./dev.db");
const id = "c" + randomBytes(12).toString("base64url").slice(0, 24);
const now = new Date().toISOString();

const existing = db
  .prepare("SELECT id FROM Playbook WHERE industrySlug = ?")
  .get(pb.industrySlug);

if (existing) {
  db.prepare(
    `UPDATE Playbook SET name=?, summary=?, markdown=?, top3UseCases=?, citations=?, researchTranscript=?, model=?, updatedAt=? WHERE id=?`,
  ).run(
    pb.name,
    pb.summary,
    pb.markdown,
    JSON.stringify(pb.top3UseCases ?? []),
    JSON.stringify(pb.citations ?? []),
    result.result,
    "sonnet",
    now,
    existing.id,
  );
  console.log(`updated existing playbook ${existing.id} (${pb.industrySlug})`);
  console.log(`open: http://localhost:3000/playbooks/${existing.id}`);
} else {
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
    result.result,
    "sonnet",
    "draft",
    now,
    now,
  );
  console.log(`inserted playbook ${id} (${pb.industrySlug})`);
  console.log(`open: http://localhost:3000/playbooks/${id}`);
}
db.close();

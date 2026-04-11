// One-shot: seed a starter AI Audit campaign so the user has something to
// drop leads into immediately. Safe to re-run; upserts by name.

import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

// Read the default pitch from the TS file so it stays in sync.
const pitchSrc = readFileSync("./src/lib/defaultPitch.ts", "utf8");
const pitchMatch = pitchSrc.match(/DEFAULT_AUDIT_PITCH\s*=\s*`([\s\S]*?)`/);
if (!pitchMatch) throw new Error("couldn't parse DEFAULT_AUDIT_PITCH from defaultPitch.ts");
const pitch = pitchMatch[1];

const db = new Database("./dev.db");
const NAME = "AI Audit — ICP run 1";

const existing = db
  .prepare("SELECT id FROM Campaign WHERE name = ?")
  .get(NAME);

const now = new Date().toISOString();

if (existing) {
  db.prepare(
    "UPDATE Campaign SET pitch = ?, updatedAt = ? WHERE id = ?",
  ).run(pitch, now, existing.id);
  console.log(`updated ${existing.id} (${NAME})`);
  console.log(`open: http://localhost:3000/campaigns/${existing.id}`);
} else {
  const id = "c" + randomBytes(12).toString("base64url").slice(0, 24);
  db.prepare(
    `INSERT INTO Campaign (id, name, niche, location, pitch, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    NAME,
    "knowledge-work SMBs",
    "(any — import Apollo CSV)",
    pitch,
    "ready",
    now,
    now,
  );
  console.log(`created ${id} (${NAME})`);
  console.log(`open: http://localhost:3000/campaigns/${id}`);
}
db.close();

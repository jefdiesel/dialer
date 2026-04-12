// Quick test script: create campaign, scrape Indeed, enrich, personalize.
// Run with: node scripts/test-campaign.mjs

import Database from "better-sqlite3";

const db = new Database("./dev.db");

// 1. Create campaign
const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const pitch = `I sell a $400 AI Audit to small, owner-operated businesses. The deliverable is a written report delivered within 48 hours with specific recommendations on where AI could save them real money — with dollar figures and step-by-step next actions.

How it works: they book at sendprop.com, fill out a quick intake form about their business and pain points, and optionally hop on a 15-minute call. I analyze their operation and write the report. No long meetings, no sales pitch — just the report in their inbox.

Guarantee: if the recommendations aren't worth at least $10k/year in likely savings, full refund, no questions.

Landing page: https://sendprop.com`;

db.prepare(`INSERT INTO Campaign (id, name, niche, location, pitch, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(
  id,
  "Test: Hiring Assistants - Hudson Valley",
  "small businesses hiring admin staff",
  "Hudson Valley, NY",
  pitch,
  "draft"
);
console.log(`Campaign created: ${id}`);

// 2. Insert 10 fake leads that simulate Indeed scrape results
// (Real Indeed scrape needs Playwright + a running browser — using realistic test data instead)
const leads = [
  { biz: "Hudson Valley Dental Care", job: "Dental Office Receptionist", location: "Kingston, NY", days: 3 },
  { biz: "Rhinebeck Animal Hospital", job: "Veterinary Office Assistant", location: "Rhinebeck, NY", days: 5 },
  { biz: "Catskill Mountain Insurance", job: "Administrative Assistant", location: "Catskill, NY", days: 2 },
  { biz: "Red Hook Plumbing & Heating", job: "Office Manager", location: "Red Hook, NY", days: 7 },
  { biz: "Saugerties Family Law", job: "Legal Secretary", location: "Saugerties, NY", days: 1 },
  { biz: "Kingston Property Group", job: "Property Management Assistant", location: "Kingston, NY", days: 4 },
  { biz: "Woodstock Wellness Center", job: "Front Desk Coordinator", location: "Woodstock, NY", days: 6 },
  { biz: "New Paltz Auto Body", job: "Service Writer / Receptionist", location: "New Paltz, NY", days: 3 },
  { biz: "Beacon Accounting Services", job: "Bookkeeping Assistant", location: "Beacon, NY", days: 2 },
  { biz: "Poughkeepsie Pediatrics", job: "Medical Office Assistant", location: "Poughkeepsie, NY", days: 8 },
];

for (const l of leads) {
  const leadId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const enriched = JSON.stringify({
    source: "indeed",
    signals: ["hiring", "intent:job-posting"],
    indeed: {
      searchedTitles: ["administrative assistant", "office manager", "receptionist"],
      jobTitle: l.job,
      jobUrl: `https://indeed.com/jobs?q=${encodeURIComponent(l.job)}`,
      postedDaysAgo: l.days,
      snippet: `${l.biz} is looking for a ${l.job} to join our team. Must be detail-oriented, organized, and comfortable with phones, scheduling, and basic computer tasks.`,
    },
    textSample: `${l.biz} is looking for a ${l.job} to join our team.`,
  });

  db.prepare(`INSERT INTO Lead (id, campaignId, businessName, address, enriched, enrichedAt, status, notes, updatedAt) VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, datetime('now'))`).run(
    leadId,
    id,
    l.biz,
    l.location,
    enriched,
    "new",
    `Indeed: hiring for "${l.job}" (${l.days} days ago)`
  );
}

console.log("Inserted 10 leads with Indeed hiring signals");

// List what we have
const rows = db.prepare("SELECT id, businessName, status, notes FROM Lead WHERE campaignId = ?").all(id);
for (const r of rows) {
  console.log(`  [${r.status}] ${r.businessName} — ${r.notes}`);
}

console.log(`\nNext steps:`);
console.log(`  1. Open http://localhost:3000/campaigns/${id}`);
console.log(`  2. Click "Enrich" to scrape websites + find emails`);
console.log(`  3. Click "Personalize" to generate email drafts`);
console.log(`  4. Review drafts, approve, and push to tracker`);

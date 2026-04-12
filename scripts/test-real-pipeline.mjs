// Real end-to-end pipeline: scrape Indeed → enrich → personalize → print drafts
// Run with: node scripts/test-real-pipeline.mjs

import Database from "better-sqlite3";
import { chromium } from "playwright";

const db = new Database("./dev.db");
const CAMPAIGN_LOCATION = "Hudson Valley, NY";
const MAX_LEADS = 10;

// ─── 1. Create campaign ─────────────────────────────────────────
const campaignId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const pitch = `I sell a $400 AI Audit to small, owner-operated businesses. The deliverable is a written report delivered within 48 hours with specific recommendations on where AI could save them real money — with dollar figures and step-by-step next actions.

How it works: they book at sendprop.com, fill out a quick intake form about their business and pain points, and optionally hop on a 15-minute call. I analyze their operation and write the report.

Guarantee: if the recommendations aren't worth at least $10k/year in likely savings, full refund, no questions.

Landing page: https://sendprop.com`;

db.prepare(`INSERT INTO Campaign (id, name, niche, location, pitch, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(
  campaignId, "REAL TEST: Hiring Assistants - HV", "admin hiring", CAMPAIGN_LOCATION, pitch, "draft"
);
console.log(`\n✅ Campaign: ${campaignId}\n`);

// ─── 2. Scrape Indeed ────────────────────────────────────────────
console.log("🔍 Scraping Indeed for admin/office hires in Hudson Valley...\n");

const ADMIN_TITLES = [
  "administrative assistant", "office manager", "office coordinator",
  "receptionist", "front desk", "intake coordinator", "billing clerk",
];
const queryString = ADMIN_TITLES.map(t => `"${t}"`).join(" OR ");
const indeedUrl = `https://www.indeed.com/jobs?q=${encodeURIComponent(queryString)}&l=${encodeURIComponent(CAMPAIGN_LOCATION)}&sort=date&fromage=14`;

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-blink-features=AutomationControlled"],
});
const context = await browser.newContext({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  locale: "en-US",
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined });
});

const page = await context.newPage();
await page.goto(indeedUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
await new Promise(r => setTimeout(r, 5000)); // let CF + page settle

const title = await page.title();
if (title.toLowerCase().includes("just a moment")) {
  console.log("❌ Blocked by Cloudflare. Try again in a few minutes.");
  await browser.close();
  process.exit(1);
}

const jobs = await page.evaluate(() => {
  const out = [];
  const seen = new Set();
  const cards = document.querySelectorAll('div.job_seen_beacon, li div.cardOutline, div[data-jk]');
  cards.forEach(card => {
    const a = card.querySelector('h2 a, a[data-jk], a.jobTitle');
    const jobTitle = a?.textContent?.trim() ?? "";
    let url = a?.href ?? "";
    if (url && !url.startsWith("http")) url = "https://www.indeed.com" + url;
    const co = card.querySelector('[data-testid="company-name"], span.companyName')?.textContent?.trim() ?? "";
    const loc = card.querySelector('[data-testid="text-location"], div.companyLocation')?.textContent?.trim() ?? "";
    const snippet = card.querySelector('div.job-snippet, [data-testid="job-snippet"], ul li')?.textContent?.trim()?.slice(0, 400) ?? "";
    const dateText = card.querySelector('span.date, [data-testid="myJobsStateDate"]')?.textContent?.trim() ?? "";
    if (!jobTitle || !co || seen.has(co.toLowerCase())) return;
    seen.add(co.toLowerCase());
    out.push({ jobTitle, companyName: co, location: loc, snippet, url, dateText });
  });
  return out;
});
await browser.close();

console.log(`Found ${jobs.length} unique companies on Indeed.\n`);

const leads = jobs.slice(0, MAX_LEADS);
if (leads.length === 0) {
  console.log("No results. Indeed may have changed layout or the area has no postings. Try a different location.");
  process.exit(0);
}

// Insert leads
for (const j of leads) {
  const leadId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const enriched = JSON.stringify({
    source: "indeed",
    signals: ["hiring", "intent:job-posting"],
    indeed: { jobTitle: j.jobTitle, jobUrl: j.url, postedDaysAgo: null, snippet: j.snippet },
    textSample: j.snippet,
  });
  db.prepare(`INSERT INTO Lead (id, campaignId, businessName, address, enriched, enrichedAt, status, notes, updatedAt) VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, datetime('now'))`).run(
    leadId, campaignId, j.companyName, j.location, enriched, "new",
    `Indeed: hiring "${j.jobTitle}"`
  );
  console.log(`  📌 ${j.companyName} — hiring "${j.jobTitle}" (${j.location})`);
}

console.log(`\n✅ ${leads.length} real leads inserted.\n`);
console.log(`Next: open http://localhost:3000/campaigns/${campaignId}`);
console.log(`  1. Click "Enrich" to scrape their websites + find emails`);
console.log(`  2. Click "Personalize" to generate cold email drafts`);
console.log(`  3. Review the drafts — DO NOT push to tracker (this is a test)\n`);

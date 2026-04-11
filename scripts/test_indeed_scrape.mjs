// Smoke test the Indeed scraper against a live search. Run with:
//   node scripts/test_indeed_scrape.mjs

import { chromium } from "playwright";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const url =
  "https://www.indeed.com/jobs?q=administrative+assistant&l=Austin%2C+TX&sort=date&fromage=7";

console.log("launching chromium...");
const browser = await chromium.launch({
  headless: true,
  args: [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
  ],
});

try {
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "America/Chicago",
    extraHTTPHeaders: { "accept-language": "en-US,en;q=0.9" },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
  });

  const page = await context.newPage();
  console.log(`navigating to ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  console.log(`waiting 5s for Cloudflare...`);
  await new Promise((r) => setTimeout(r, 5000));

  const title = await page.title();
  console.log(`page title: "${title}"`);

  if (title.toLowerCase().includes("just a moment") || title.toLowerCase().includes("not found")) {
    console.log("BLOCKED by Cloudflare.");
    console.log("saving screenshot to /tmp/indeed_blocked.png");
    await page.screenshot({ path: "/tmp/indeed_blocked.png", fullPage: true });
    process.exit(1);
  }

  const jobs = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    const cards = document.querySelectorAll(
      'div.job_seen_beacon, li div.cardOutline, div[data-jk]',
    );
    cards.forEach((card) => {
      const titleAnchor = card.querySelector('h2 a, a[data-jk], a.jobTitle');
      const jobTitle = titleAnchor?.textContent?.trim() ?? "";
      let url = titleAnchor?.href ?? "";
      if (url && !url.startsWith("http")) url = `https://www.indeed.com${url}`;
      const companyEl = card.querySelector(
        '[data-testid="company-name"], span.companyName, .companyName',
      );
      const companyName = companyEl?.textContent?.trim() ?? "";
      const locEl = card.querySelector(
        '[data-testid="text-location"], div.companyLocation, .companyLocation',
      );
      const location = locEl?.textContent?.trim() ?? "";
      if (!jobTitle || !companyName || !url || seen.has(url)) return;
      seen.add(url);
      out.push({ jobTitle, companyName, location, url });
    });
    return out;
  });

  console.log(`\nfound ${jobs.length} jobs:\n`);
  for (const j of jobs.slice(0, 10)) {
    console.log(`- ${j.jobTitle.padEnd(40)} @ ${j.companyName}  (${j.location})`);
  }

  if (jobs.length === 0) {
    console.log("\nno jobs found — selector may have drifted. Saving HTML to /tmp/indeed_html.html");
    const html = await page.content();
    (await import("node:fs")).writeFileSync("/tmp/indeed_html.html", html);
    await page.screenshot({ path: "/tmp/indeed_page.png", fullPage: true });
    console.log("also saved screenshot to /tmp/indeed_page.png");
  }
} finally {
  await browser.close();
}

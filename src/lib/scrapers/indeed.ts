// Indeed job posting scraper via Playwright.
//
// Why Playwright: Indeed is behind Cloudflare + aggressive anti-bot. Direct
// fetch returns 403 with a challenge page. The RSS feed was killed. The
// public API was shut down. Playwright running a real browser is the only
// reliable free path left.
//
// Strategy:
//   1. Launch a headless Chromium with realistic user agent + viewport
//   2. Navigate to Indeed's jobs search URL
//   3. Wait for DOM to stabilize
//   4. Extract visible listings
//   5. Return [{jobTitle, companyName, location, snippet, url, postedDaysAgo}]
//
// Intentionally conservative: small page sizes, random delays, one search at a
// time. The goal is 20-50 reliable listings per run, not 1000.

import { chromium, type Browser } from "playwright";

export type IndeedJob = {
  jobTitle: string;
  companyName: string;
  location: string;
  snippet: string;
  url: string;
  postedDaysAgo: number | null;
  scrapedAt: string;
};

type ScrapeOptions = {
  // Either a single search string OR an array of job titles to OR together.
  // Real businesses post a dozen variations for the same role
  // (office manager, office coordinator, receptionist, intake coordinator,
  // executive assistant, front desk, etc.) — use the array form to catch
  // all of them in one search.
  query: string | string[];
  location: string; // e.g. "Austin, TX"
  maxResults?: number; // cap, default 25
};

// Indeed supports OR queries. Quoted phrases match multi-word titles exactly,
// then we OR the whole list together. Anything that smells like an admin /
// office / paperwork role is in the default set.
export const ADMIN_ROLE_TITLES = [
  "administrative assistant",
  "office manager",
  "office coordinator",
  "office admin",
  "office administrator",
  "executive assistant",
  "receptionist",
  "front desk",
  "intake coordinator",
  "billing clerk",
  "billing specialist",
  "operations coordinator",
  "data entry",
  "file clerk",
  "scheduling coordinator",
];

function buildIndeedQuery(query: string | string[]): string {
  if (typeof query === "string") return query;
  if (query.length === 1) return query[0];
  // Quote each term that contains a space, then OR them together.
  return query
    .map((t) => (t.includes(" ") ? `"${t}"` : t))
    .join(" OR ");
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(base: number, range: number) {
  return base + Math.floor(Math.random() * range);
}

function parsePostedDaysAgo(text: string | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("just posted") || t.includes("today")) return 0;
  const m = t.match(/(\d+)\+?\s*days?\s*ago/);
  if (m) return parseInt(m[1], 10);
  const hr = t.match(/(\d+)\+?\s*hours?\s*ago/);
  if (hr) return 0;
  return null;
}

export async function scrapeIndeed(opts: ScrapeOptions): Promise<IndeedJob[]> {
  const maxResults = opts.maxResults ?? 25;
  const queryString = buildIndeedQuery(opts.query);
  const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(queryString)}&l=${encodeURIComponent(opts.location)}&sort=date&fromage=7`;

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
    });

    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1440, height: 900 },
      locale: "en-US",
      timezoneId: "America/Chicago",
      extraHTTPHeaders: {
        "accept-language": "en-US,en;q=0.9",
      },
    });

    // Scrub the navigator.webdriver flag and a few other obvious tells.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      // @ts-ignore
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
      // @ts-ignore
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Cloudflare challenge sometimes takes ~5s to resolve. Wait for either
    // the job list or a challenge marker.
    await sleep(jitter(3000, 2000));

    // If we got bounced to a challenge page, abort gracefully.
    const title = await page.title();
    if (title.toLowerCase().includes("just a moment") || title.toLowerCase().includes("not found")) {
      throw new Error(`blocked by Cloudflare challenge (page title: "${title}")`);
    }

    // Indeed's listings live in <div class="job_seen_beacon"> or similar. The
    // selector has changed a lot — we try several known patterns and fall
    // back to a generic anchor scrape.
    type RawJob = {
      jobTitle: string;
      companyName: string;
      location: string;
      snippet: string;
      url: string;
      postedText: string;
    };
    const jobs: RawJob[] = await page.evaluate(() => {
      const out: any[] = [];
      const seenUrls = new Set<string>();

      // Modern layout: div.job_seen_beacon, each with h2 > a for title + url,
      // [data-testid="company-name"] for the company, etc.
      const cards = document.querySelectorAll<HTMLElement>(
        'div.job_seen_beacon, li div.cardOutline, div[data-jk]',
      );

      cards.forEach((card) => {
        // Title + URL
        const titleAnchor = card.querySelector<HTMLAnchorElement>(
          'h2 a, a[data-jk], a.jobTitle',
        );
        const jobTitle = titleAnchor?.textContent?.trim() ?? "";
        let url = titleAnchor?.href ?? "";
        if (url && !url.startsWith("http")) url = `https://www.indeed.com${url}`;

        // Company name
        const companyEl = card.querySelector<HTMLElement>(
          '[data-testid="company-name"], span.companyName, .companyName',
        );
        const companyName = companyEl?.textContent?.trim() ?? "";

        // Location
        const locEl = card.querySelector<HTMLElement>(
          '[data-testid="text-location"], div.companyLocation, .companyLocation',
        );
        const location = locEl?.textContent?.trim() ?? "";

        // Snippet
        const snippetEl = card.querySelector<HTMLElement>(
          'div.job-snippet, [data-testid="job-snippet"], ul li',
        );
        const snippet = snippetEl?.textContent?.trim().slice(0, 400) ?? "";

        // Posted date
        const dateEl = card.querySelector<HTMLElement>(
          'span.date, [data-testid="myJobsStateDate"]',
        );
        const postedText = dateEl?.textContent?.trim() ?? "";

        if (!jobTitle || !companyName || !url || seenUrls.has(url)) return;
        seenUrls.add(url);

        out.push({
          jobTitle,
          companyName,
          location,
          snippet,
          url,
          postedText,
        });
      });

      return out;
    });

    const parsed = jobs.slice(0, maxResults).map((j) => ({
      jobTitle: j.jobTitle,
      companyName: j.companyName,
      location: j.location,
      snippet: j.snippet,
      url: j.url,
      postedDaysAgo: parsePostedDaysAgo(j.postedText),
      scrapedAt: new Date().toISOString(),
    }));

    return parsed;
  } finally {
    if (browser) await browser.close();
  }
}

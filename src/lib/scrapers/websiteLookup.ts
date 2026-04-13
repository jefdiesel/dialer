// Find a business's actual website by name + location, via DuckDuckGo HTML
// search. Free, no API key, no aggressive rate limiting.
//
// Strategy:
//   1. Hit https://html.duckduckgo.com/html/?q=<name + city>
//   2. Parse all result URLs (they're wrapped in /l/?uddg=...)
//   3. Filter out aggregators (yelp, yellowpages, npi, etc.)
//   4. Return the first surviving domain
//
// Indeed leads have no website by default — this is what unblocks them.

const AGGREGATOR_DOMAINS = [
  "yelp.com",
  "yellowpages.com",
  "indeed.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "bbb.org",
  "manta.com",
  "mapquest.com",
  "npiprofile.com",
  "npino.com",
  "healthgrades.com",
  "medicarelist.com",
  "vitals.com",
  "zocdoc.com",
  "ratemds.com",
  "wellness.com",
  "doximity.com",
  "google.com",
  "googleusercontent.com",
  "amazon.com",
  "wikipedia.org",
  "youtube.com",
  "tiktok.com",
  "reddit.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "monster.com",
  "simplyhired.com",
  "trulia.com",
  "zillow.com",
  "realtor.com",
  "homeadvisor.com",
  "angi.com",
  "thumbtack.com",
  "yellowbook.com",
  "superpages.com",
  "chamberofcommerce.com",
  "buzzfile.com",
  "owler.com",
  "crunchbase.com",
  "zoominfo.com",
  "rocketreach.co",
  "apollo.io",
  "hunter.io",
];

const DDG_URL = "https://html.duckduckgo.com/html/";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function isAggregator(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return AGGREGATOR_DOMAINS.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return true;
  }
}

function decodeDdgRedirect(href: string): string | null {
  // DDG wraps results as: //duckduckgo.com/l/?uddg=<encoded url>&rut=...
  // OR sometimes as plain https URLs.
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) href = "https:" + href;
  try {
    const u = new URL(href);
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : null;
  } catch {
    return null;
  }
}

function extractResultUrls(html: string): string[] {
  // Match every <a class="result__url" href="..."> on the page.
  const re = /class="result__url"[^>]*href="([^"]+)"/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const decoded = decodeDdgRedirect(m[1].replace(/&amp;/g, "&"));
    if (decoded) out.push(decoded);
  }
  return out;
}

export type WebsiteLookupResult = {
  url: string;
  rank: number; // 1-indexed position in results
} | null;

export async function findWebsiteForBusiness(
  name: string,
  location?: string | null,
): Promise<WebsiteLookupResult> {
  const query = [name, location].filter(Boolean).join(" ");
  const params = new URLSearchParams({ q: query });

  let html = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    const res = await fetch(`${DDG_URL}?${params.toString()}`, {
      method: "GET",
      signal: ctl.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (res.status === 429 || res.status === 403) {
      // Rate limited — wait and retry
      continue;
    }
    if (!res.ok) {
      throw new Error(`DuckDuckGo HTML returned ${res.status}`);
    }
    html = await res.text();
    break;
  }
  if (!html) return null; // all retries exhausted

  const urls = extractResultUrls(html);
  let rank = 0;
  for (const url of urls) {
    rank++;
    if (isAggregator(url)) continue;
    // Normalize: drop trailing path noise, keep the origin + maybe a subpath.
    try {
      const u = new URL(url);
      // If the URL is a subpath, return the origin instead — we want the
      // company's home page, not a deep link to a product page.
      return { url: u.origin, rank };
    } catch {
      continue;
    }
  }
  return null;
}

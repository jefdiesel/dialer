# Site Chat Widget (Hours/FAQ)

**One-liner:** A small chat bubble on their website that answers "what time are you open / do you service X / how much for Y" from their own content. No more phone calls for questions Google should answer.

## Pain (observable in public)
SMB websites are static brochures. Customers with basic questions either call (wasting owner's time on non-buying questions) or bounce. Most SMB sites have no chat widget; the ones that do have a dead Facebook Messenger iframe last touched in 2019.

## How to find targets (the scanner)
- Scrape SMB websites by niche + city
- Detect: no chat widget in the DOM (check for common selectors: `intercom`, `drift`, `tidio`, `crisp`, `tawk`, `hubspot`, `messenger`)
- Flag sites with **none** of these loaded
- Bonus signal: site has a "Contact" or "FAQ" page (they care enough to try, not enough to solve it)

## What we build (the product)
- Scrape their website once at onboarding (all public pages)
- Load content into a vector store
- Small JS widget they embed with one `<script>` tag
- Claude (with Haiku fallback for cost) answers questions grounded in their pages + owner-provided FAQ
- "I don't know" fallback hands off to a contact form or phone number
- Simple admin view: see what people asked, flag wrong answers, add corrections

## Build effort
5–8 hours. Scraper + vector store + Claude + embeddable widget + tiny admin.

## Pricing
- **Setup:** $1,500 flat
- **Monthly:** $49–$79 (Claude API passthrough)
- **Per-client cost to us:** ~$5–10/mo in Anthropic (Haiku is cheap) + hosting share

## Cold email template
> Subject: Your website has no way for visitors to ask a question
>
> John — I was looking at midwayautoparts.com and noticed there's no chat or message widget anywhere on the site. Every question a visitor has right now either becomes a phone call (taking your counter guys off real work) or a bounce.
>
> I build a small chat widget that knows your hours, services, brands you carry, and prices from your own pages. Answers 80% of questions automatically. $1,500 flat, yours to keep.
>
> Worth a 15-minute call?

## Why this is a good product
- Dead simple signal (script tag check = objective)
- Widget is visible on their site after install — social proof compounds
- Low price point closes quickly
- Haiku keeps per-message cost near-zero
- Every SMB site is a target

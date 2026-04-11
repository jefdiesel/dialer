# Quote-from-Message Generator

**One-liner:** Customer describes a job in plain English. AI turns it into an itemized quote using the shop's own pricing sheet. Owner reviews, sends as PDF.

## Pain (observable in public)
Service businesses quote by hand, which is why quotes take 1–3 days. Customers go with whoever replies first. Small shops lose to larger competitors purely on response time, even when their price is better.

## How to find targets (the scanner)
- Scrape SMB websites by niche (landscapers, HVAC, electricians, plumbers, painters, remodeling)
- Submit a **dummy job request** through their "request a quote" form with a realistic job description
- Measure time-to-quote
- Any shop that takes >24 hours (most of them) = qualified target, with proof

## What we build (the product)
- Form the customer fills out describing the job (or we parse a text/email)
- Shop provides a pricing sheet once at onboarding (catalog, hourly rates, markups)
- Claude parses the request → generates an itemized quote with line items, totals, tax
- Outputs a clean PDF with the shop's branding
- Owner reviews in a dashboard, one click to send to customer
- Tracks acceptance/decline

## Build effort
12–20 hours. Form + Claude parsing + pricing rules engine + PDF generator + admin dashboard. Higher because each shop has unique pricing logic.

## Pricing
- **Setup:** $3,500 flat (higher because pricing rule setup is per-client work)
- **Monthly:** $99–$149
- **Per-client cost to us:** ~$5–15/mo in Anthropic + hosting

## Cold email template
> Subject: I asked you for a quote Sunday. Still waiting.
>
> John — I submitted a quote request on midwayautoparts.com Sunday afternoon for a set of tires on a 2019 Silverado. Got your quote back Tuesday at 4pm. In those 48 hours I almost certainly got quotes from Discount Tire, Costco, and a dozen other shops.
>
> I build a tool that takes a customer's request and generates a proper itemized quote in under a minute, using your pricing sheet. Owner reviews, one click to send. $3,500 flat, yours to keep.
>
> Worth a 15-minute call?

## Why this is a good product
- Kills competitors on speed, which is the SMB's actual superpower if used
- Clear, measurable outcome (quote turnaround time)
- Higher price point ($3,500) is justified by complexity
- Harder to build than the others but also harder to copy

## Caveats
- Pricing rules are per-client work — can't ship v1 as pure template
- Risk: if the quote is wrong, the client loses real money. Needs careful approval UX.
- Best starting vertical: trades where pricing is catalog-like (tires, installations, simple repairs) not truly custom (remodeling, complex labor)

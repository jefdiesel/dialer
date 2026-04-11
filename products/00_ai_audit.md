# The AI Audit — Core Product

**One-liner:** $400 fixed-price consulting engagement. Review a real SMB's operations for 2 hours, deliver a 4-6 page written report identifying 3 specific places AI could save them real money, with dollar figures and a 30-day action plan for each.

## Why this is the business (not the other 5 products)

The other 5 products in this folder (review reply, contact form, missed-call textback, chat widget, quote generator) are **candidate builds that land through this offer**, not standalone products. The audit is what the business actually sells. Candidate builds are the upsell after the audit lands.

This is the flip from earlier attempts:
- NOT: sell SaaS → lose on price and differentiation
- NOT: sell industry playbooks → vendor-biased research, bot-voice risk
- NOT: sell SMS plumbing → not AI consulting
- **YES: sell expert judgment, delivered as a productized report, with build work as the backend**

## The deliverable (4-6 page PDF report)

Structure per client:

1. **Executive Summary** (half page) — the 3 recommendations, each as a headline with dollar value
2. **Your operations as I see them** (1 page) — what we learned from the data they sent
3. **Recommendation 1** (1 page) — task, current cost (hours/week × rate), AI solution, DIY or custom build, expected ROI
4. **Recommendation 2** (1 page) — same format
5. **Recommendation 3** (1 page) — same format
6. **Where AI is NOT the answer for you** (quarter page) — honest caveats and limits; this is the credibility builder
7. **Next steps** (quarter page) — for each recommendation, what week 1 looks like; soft upsell for the custom build path

The report is client-specific, named, dollar-figured. Pretty PDF with consultant's brand.

## The process

1. **15-min intro call** — logistics only. Sign mutual NDA. Agree on what they'll share.
2. **Data dump from client** — 20 min of their time. Could be: last 90 days of invoices, a folder of customer emails, their SOP document, inventory CSV, Google Business dashboard export, photos of their paperwork pile, transcripts of 5 customer phone calls. Whatever they can pull quickly.
3. **2 hours of analysis** — consultant works with Claude in the loop. Claude processes the data for patterns; consultant interprets and writes the report.
4. **Report delivery** (PDF over email)
5. **30-min readout call** — walk through the report, answer questions, pitch the build upsell for recommendation #2 or #3.

## Pricing

- **Audit: $400 flat**
- **Guarantee:** "If the 3 recommendations aren't worth at least $10k/year, full refund, no questions."
- **Build upsell (offered during readout):** $4k-$15k flat price for a custom build of one of the recommendations

## Economics

- Audit revenue: $400 × 10/month = $4,000
- Consultant time per audit: ~2.5 hours = ~$160/hr effective
- Build upsell conversion: ~20-30%
- Build revenue: 2-3 builds/month × $4k-$15k = $8k-$45k
- **Total realistic: $12k-$49k/month** at 10 audits/month pace

The audit is the marketing for the build work, not the profit center. Treat audits as high-value lead magnets that pay for themselves.

## What the dialer does to support this

Instead of targeting by industry, target by **signs of operational complexity**:

- ≥10 employees (LinkedIn, Glassdoor, Google Business Profile)
- Document-heavy niches (insurance agencies, medical billing, accounting, law, property mgmt, wholesale/distribution, import-export, auto repair with warranty claims)
- Active content needs (real estate, ecom, active-blog businesses)
- Hiring signals ("office admin", "data entry" postings)
- Public complaints about response time or paperwork errors

The cold email pitches the audit specifically, not a vendor tool:

> Subject: An AI audit for Midway Auto Parts
>
> John — I do a fixed-price AI audit for small businesses: I spend 2 hours going through a sample of your operations (invoices, emails, SOPs, whatever you can pull in 20 min) and write you a 4-page report identifying the 3 places AI could save you real money. Specific to your shop, with dollar figures, not generic advice.
>
> $400 flat. If the 3 recommendations aren't worth at least $10k/year to your shop, full refund.
>
> Worth a 15-min call to see if it'd fit?

## Next work to support this

1. **Build the audit template/framework** — what the 4-6 page report actually looks like, the prompts Claude uses to analyze a data dump, the checklist of patterns to look for.
2. **Run a small test campaign** (10-20 hand-picked leads, cold email the audit pitch) to validate conversion before building scanner infrastructure.
3. **Retarget the dialer** — new campaign type ("audit prospecting"), new targeting criteria, deprecate industry playbooks as the primary product (they may still serve as cold-email targeting context).

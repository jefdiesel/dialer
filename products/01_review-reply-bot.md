# Google Review Reply Bot

**One-liner:** Drafts owner responses to Google reviews. Owner taps approve. Reply posts.

## Pain (observable in public)
Most SMB owners know they should reply to Google reviews but never do. Not a software problem — an energy/time problem. A shop with 127 reviews and 0 replies is the target signal.

## How to find targets (the scanner)
- Google Maps search by category + city
- Filter: businesses with ≥50 reviews
- Filter: **zero owner responses** on visible reviews
- Output: CSV of qualified leads with review count + last review date
- 100% public signal, trivially scrapeable

## What we build (the product)
- Google OAuth for Business Profile access (owner logs in once at onboarding)
- Pulls reviews via Google Business Profile API (daily cron)
- Claude drafts a reply per review, tuned from 3–5 example replies the owner provides at onboarding
- Simple approval dashboard: queue of draft replies, approve/edit/reject
- **Per-client approval policy** (configurable, not one-size-fits-all):
  - Manual approve for everything (safest, default)
  - Auto-post 5★ only, manual for ≤4★
  - Auto-post 4★ and 5★, manual for ≤3★
  - Full auto (for clients who trust the voice matching after a few weeks)
- Different drafting strategies per star rating (5★ = warm thanks, 3★ = acknowledge + offer to fix, ≤2★ = apologize + take offline, never defensive)
- Rejected drafts become negative training signal

## Build effort
6–10 hours for v1. Google Business Profile API + Claude + one-page React dashboard + daily cron.

## Pricing
- **Setup:** $1,500 flat
- **Monthly:** $49–$99 (includes Claude API passthrough for drafting)
- **Per-client cost to us:** ~$3–8/mo in Anthropic API + $10/mo hosting share

## Cold email template
> Subject: Your 127 Google reviews have no replies
>
> John — I was looking at Midway Auto Parts and noticed you have 127 Google reviews and haven't replied to any of them. Responding to reviews bumps your local search ranking and takes about 30 seconds per review once the drafts are written for you.
>
> I built a tool that drafts replies in your voice. You open a dashboard, tap approve on 20 at a time, done in 5 minutes. $1,500 flat to build it for you, yours to keep.
>
> Worth a 15-minute call?

## Why this is a good first product
- Observable signal (you can prove they have the pain before emailing)
- Cheap enough to close fast ($1,500 is impulse-buy territory)
- Clear measurable outcome (review count goes up, ratings improve)
- Builds in a day
- Reusable across every industry

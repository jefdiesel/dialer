# dialer

Outreach pipeline for selling AI consulting at $200/hr.

## Pipeline

1. **Discover** — Google Places Text Search by niche + city → leads
2. **Enrich** — fetch each lead's website, extract email + business signals, score AI fit
3. **Personalize** — Claude (Sonnet 4.6) writes a per-lead subject + body
4. **Review** — campaign dashboard to edit/approve/reject drafts
5. **Hand off** — push approved drafts to the existing tracker (Gmail OAuth + open pixel). Sending and tracking happen there, not here.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Prisma 7 + SQLite (via `@prisma/adapter-better-sqlite3`)
- Anthropic SDK
- Google Places API (New)

## Setup

```bash
npm install
cp .env.example .env  # fill in keys
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000 → create a campaign → click the three pipeline buttons in order.

## Tracker integration

`src/lib/tracker.ts` is currently **stubbed**. It logs the handoff and marks drafts as `handed_off` in the DB but doesn't talk to the real tracker yet. To wire it up, fill in the `fetch()` block in `pushToTracker` with the tracker's API shape and set `TRACKER_BASE_URL` / `TRACKER_API_KEY`.

## Phase 2 (not yet built)

- LinkedIn DM drafts (manual paste)
- Contact-form fallback via Playwright
- TikTok ads (separate workstream — paid broadcast, not 1:1)

# Missed-Call Text-Back

**One-liner:** When a customer calls and the shop misses it, they instantly get a text asking what they need. Reply forwards to owner's cell.

## Pain (observable in public)
Service businesses miss 30–40% of inbound calls — owner is on another call, with a customer, in a bay, in a meeting. Every missed call is a lost job, and they have no idea how many they're losing.

## How to find targets (the scanner)
- Get a list of businesses by category + city (Google Places)
- **Secret shopper call** during known-busy hours (Saturday morning, lunch rush)
- Log call result: answered / voicemail / straight-to-VM / hold forever
- Any business that hit voicemail twice = qualified lead with proof

## What we build (the product)
**No AI. Dumb autoresponder + SMS relay.**

1. Customer calls shop → misses
2. Twilio sends canned SMS: *"Hey, sorry we missed you! Text us what you need and we'll get back to you shortly."*
3. Customer texts back their need
4. Twilio forwards the text to owner's cell as: *"New message from +15551234: 'need a caliper for a 97 F-150'. Reply to this text to respond."*
5. Owner replies to the forwarded text from his regular phone
6. Twilio relays the reply back to the customer through the business number

Owner never opens an app. Everything lives in iMessage/Android Messages.

## Build effort
2–4 hours. Twilio Studio flow + webhook handler + relay logic. No frontend needed for MVP.

## Pricing
- **Setup:** $2,500 flat
- **Monthly:** $99 (covers Twilio passthrough + margin)
- **Per-client cost to us:** ~$28/mo (see cost breakdown below)

## Per-client cost breakdown (Twilio/A2P passthrough)
| Item | Monthly |
|---|---|
| Client brand reg (TCR) amortized | $4 |
| Campaign reg amortized | $3 |
| Dedicated number | $1 |
| A2P carrier baseline | $2 |
| ~2,250 SMS at ~$0.008 avg (5 legs × 15 missed calls/day) | $18 |
| **Total** | **~$28** |

Higher volume scales linearly. Tier the pricing: $99/mo up to 20 missed calls/day, $149 up to 40, etc.

## Operational gotcha: A2P 10DLC

US SMS requires brand + campaign registration per client (FCC mandate). Path is one of:

- **ISV model (recommended):** You open Twilio ISV/reseller account once. Each client gets a subaccount + dedicated number + brand registered under your parent. First client takes 2–3 weeks to approve. Clients 2–5 take 3–7 days. Client 6+ is effectively same-week.
- **Client owns their own Twilio (cleanest):** Client opens their own account, you get API keys, you build, you walk away. No recurring on your side. Trade-off: 30 min of paperwork for the client, some will bounce.

## Cold email template
> Subject: I called you Saturday at 11am — nobody picked up
>
> John — I called Midway Auto Parts this Saturday at 11am and got voicemail. Every missed call in a service business is probably $200–$500 in lost work. At 10+ missed calls a week, that's real money walking out the door.
>
> I build a tool that texts the caller back in 30 seconds: "sorry we missed you, what do you need?" — and forwards their reply to your cell phone so you can respond without opening an app. $2,500 flat, ~$99/month for the SMS infrastructure. Yours to keep.
>
> Worth a 15-minute call?

## Why this is a good product
- Brutal, measurable proof point (voicemail = lost job)
- Zero new software for the owner to learn (everything in iMessage)
- No AI needed → simpler, more reliable, cheaper to run
- High emotional impact in the cold email

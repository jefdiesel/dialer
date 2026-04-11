# Contact Form Auto-Qualifier

**One-liner:** When someone submits a contact form, they get a qualifying reply in 30 seconds instead of 3 days.

## Pain (observable in public)
Contact forms on SMB sites are black holes. Owner checks email once a day, replies maybe 40% of the time, by then the prospect went elsewhere. Meanwhile leads contacted in <5 minutes convert at 9x the rate of leads contacted after 30 minutes.

## How to find targets (the scanner)
- Scrape a list of SMB websites (by niche + city)
- Submit a **dummy lead** through each contact form — realistic name, plausible inquiry
- Wait 48 hours
- Any site that didn't reply = qualified target, with a timestamp as proof
- Log the exact form URL and the dead-air duration

## What we build (the product)
- Webhook on their existing contact form (or new form we host)
- Instant auto-reply: "Thanks for reaching out, can I ask what you're looking for, when you need it, and roughly what budget?"
- Claude handles the 2–3 message back-and-forth to qualify
- When qualified, either books directly to owner's calendar (Calendly/Cal.com integration) OR pings owner's phone/email with "qualified lead ready to talk, here's the conversation"

## Build effort
8–15 hours. Webhook + Claude conversation state machine + calendar API + simple admin view.

## Pricing
- **Setup:** $2,500 flat
- **Monthly:** $75–$125 (Claude API passthrough)
- **Per-client cost to us:** ~$5–15/mo Anthropic + hosting share

## Cold email template
> Subject: I filled out your contact form Sunday. Still waiting.
>
> John — I submitted a lead through your website contact form on Sunday. It's now Thursday and I still haven't heard back. In those 4 days you probably lost 2–3 real leads to shops that replied faster.
>
> I build a tool that replies to form submissions in under 60 seconds, qualifies them with a short conversation, and books the good ones straight into your calendar. $2,500 flat, yours to keep.
>
> Worth a 15-minute call?

## Why this is a good product
- The dead form submission IS the proof. Email literally says "I sent you a lead, you ignored it."
- Emotional response — owner is embarrassed, motivated to fix it
- Every SMB with a website has this problem
- Measurable outcome (response time, conversion rate)

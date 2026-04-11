# Daily cron — auto-detect replies and send due follow-ups

The dialer exposes one cron endpoint that does the full daily ritual:

```
GET /api/cron/follow-ups
```

It runs in this order:
1. **Detect replies** — pulls recent emails from the tracker, finds any with replies, marks the matching leads as `replied` and cancels their scheduled follow-ups.
2. **Send due follow-ups** — walks all `scheduled` drafts whose `dueAt` has passed, generates the body, sends via the tracker, schedules the next step in the sequence.

Returns a JSON summary of what happened.

## Auth

If `CRON_SECRET` is set in `.env`, the endpoint requires `Authorization: Bearer <secret>`. If unset, it's open (fine for local-only dev).

Generate one and add it to `.env`:

```bash
echo "CRON_SECRET=$(openssl rand -hex 32)" >> .env
```

## Manual test

```bash
curl -sS -H "Authorization: Bearer YOUR_SECRET" http://localhost:3000/api/cron/follow-ups | jq
```

## Run it daily on macOS via launchd

1. Edit `scripts/com.dialer.cron.plist` and replace `REPLACE_WITH_YOUR_CRON_SECRET` with the secret you generated.
2. Copy it into your LaunchAgents directory:
   ```bash
   cp scripts/com.dialer.cron.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.dialer.cron.plist
   ```
3. Verify it loaded:
   ```bash
   launchctl list | grep dialer
   ```
4. Logs land in `/tmp/dialer-cron.log` and `/tmp/dialer-cron.err`.

The default schedule is **9 AM local time daily**. Edit the `StartCalendarInterval` block in the plist to change.

## To disable

```bash
launchctl unload ~/Library/LaunchAgents/com.dialer.cron.plist
rm ~/Library/LaunchAgents/com.dialer.cron.plist
```

## Caveats

- The dialer's `next dev` server (or `next start` in prod) must be running for the cron to hit it. If you reboot, you need to restart the dev server before the next 9 AM tick.
- Reply detection assumes the tracker's `/api/track/emails` endpoint exposes a "this email got a reply" field (or that we can match by email + subject). If the actual response shape differs, run `node scripts/probe_tracker_api.mjs` and tell me what fields show up — I'll patch the parser.

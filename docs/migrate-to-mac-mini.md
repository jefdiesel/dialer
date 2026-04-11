# Migrate the dialer from your laptop to the Mac mini

You're currently running the dialer on your laptop. To expose it publicly via your existing Cloudflare tunnel (so `sendprop.com` can point at the audit funnel), it needs to live on the Mac mini that already runs `email.buggers.online`.

This is a one-time setup. ~30 minutes.

## Prereqs on the Mac mini

You probably already have these because the tracker runs there, but verify:

```bash
node -v   # need 20+
npm -v
git --version
cloudflared --version  # for the tunnel
```

If `node` is missing, install via nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 24
```

## Clone the repo on the Mac mini

```bash
cd ~
git clone git@github.com:jefdiesel/dialer.git
cd dialer
npm install
npx playwright install chromium
```

## Copy your .env from the laptop to the Mac mini

The mini needs the same env vars. The fastest way is to scp from laptop:

```bash
# From your laptop (NOT the mini):
scp ~/dialer/.env <mini-username>@<mini-hostname>:~/dialer/.env
```

Or copy by hand into `~/dialer/.env` on the mini. Required vars:

```
DATABASE_URL="file:./dev.db"
GOOGLE_PLACES_API_KEY=...
TRACKER_BASE_URL=https://email.buggers.online
TRACKER_EMAIL=...           # your tracker login (NOT Gmail)
TRACKER_PASSWORD=...
CRON_SECRET=...             # optional but recommended
PUBLIC_BASE_URL=https://sendprop.com   # the new audit funnel hostname
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Initialize the database on the mini

```bash
npx prisma migrate deploy
npx prisma generate
```

This creates a fresh `dev.db` on the mini. **Note: this won't carry over your laptop's existing leads, campaigns, or playbooks.** If you want those, copy `dev.db` over too:

```bash
# From laptop:
scp ~/dialer/dev.db <mini-username>@<mini-hostname>:~/dialer/dev.db
```

## Run the dialer as a background service

You want it to survive reboots and run 24/7. Use a launchd LaunchAgent:

Create `~/Library/LaunchAgents/com.dialer.app.plist` on the mini with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.dialer.app</string>
    <key>WorkingDirectory</key>
    <string>/Users/YOUR_USERNAME/dialer</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/YOUR_USERNAME/.nvm/versions/node/v24.11.1/bin/node</string>
        <string>/Users/YOUR_USERNAME/.nvm/versions/node/v24.11.1/bin/npm</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/dialer-app.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/dialer-app.err</string>
</dict>
</plist>
```

Replace `YOUR_USERNAME` and the node path. Then:

```bash
cd ~/dialer
npm run build         # production build, only needed once per code change
launchctl load ~/Library/LaunchAgents/com.dialer.app.plist
```

The dialer is now running on `localhost:3000` on the mini, surviving reboots.

## Add a Cloudflare tunnel hostname

In your Cloudflare dashboard for `sendprop.com`:

1. Go to **Zero Trust → Networks → Tunnels** (this is where `email.buggers.online` is configured)
2. Click your existing tunnel (or create a new one)
3. Click **Public Hostname → Add a public hostname**
4. Subdomain: leave blank (for the apex `sendprop.com`) or enter `audit` for `audit.sendprop.com`
5. Domain: `sendprop.com`
6. Service: `HTTP` `localhost:3000`
7. Save

DNS for `sendprop.com` should be on Cloudflare. If it isn't, update your registrar's nameservers to Cloudflare's first.

After ~60 seconds, `https://sendprop.com/audit` should load the audit landing page from the mini.

## Set up Stripe

1. Go to https://dashboard.stripe.com/apikeys
2. Copy the **Secret key** (test mode is fine to start: `sk_test_...`)
3. Put it in `~/dialer/.env` as `STRIPE_SECRET_KEY`
4. Go to https://dashboard.stripe.com/webhooks → **Add endpoint**
5. Endpoint URL: `https://sendprop.com/api/stripe/webhook`
6. Events: `checkout.session.completed`, `charge.refunded`
7. Copy the **Signing secret** (`whsec_...`)
8. Put it in `~/dialer/.env` as `STRIPE_WEBHOOK_SECRET`
9. Restart the dialer: `launchctl unload ~/Library/LaunchAgents/com.dialer.app.plist && launchctl load ~/Library/LaunchAgents/com.dialer.app.plist`

Test by visiting `https://sendprop.com/audit`, filling in fake details, and clicking "Pay $400 and start". You'll be sent to Stripe's test checkout. Use card `4242 4242 4242 4242`, any future date, any CVC. Webhook should fire and you should land on the upload form.

## Cron for daily follow-ups

Once everything is up, install the daily cron from `docs/cron-setup.md` (also runs on the mini, also via launchd).

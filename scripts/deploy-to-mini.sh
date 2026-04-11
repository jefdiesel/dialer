#!/usr/bin/env bash
# One-shot deploy script for the dialer on a fresh Mac mini.
#
# Usage (on the mini):
#   curl -sSL https://raw.githubusercontent.com/jefdiesel/dialer/main/scripts/deploy-to-mini.sh | bash
# OR if you've already cloned:
#   cd ~/dialer && bash scripts/deploy-to-mini.sh
#
# What this does:
#   1. Verifies prereqs (git, node 20+, npm)
#   2. Clones or updates the repo at ~/dialer
#   3. Installs dependencies + Playwright Chromium
#   4. Generates a CRON_SECRET if .env doesn't have one
#   5. Runs DB migrations
#   6. Builds the production bundle
#   7. Writes + loads launchd plists for the dialer app AND the daily cron
#
# What this does NOT do (you must do manually):
#   - Add Stripe keys to .env (script will tell you what's missing)
#   - Configure the Cloudflare tunnel hostname (Zero Trust dashboard, UI only)
#   - Sign up for Stripe + create the webhook (UI only)
#
# Re-run this script any time after pulling updates. It's idempotent.

set -euo pipefail

REPO_URL="git@github.com:jefdiesel/dialer.git"
INSTALL_DIR="${HOME}/dialer"
APP_LABEL="com.dialer.app"
CRON_LABEL="com.dialer.cron"

cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }

step() { cyan "==> $*"; }
warn() { yellow "[!] $*"; }
err()  { red "[X] $*"; }
ok()   { green "[✓] $*"; }

# ---- 1. Prereqs ----------------------------------------------------------
step "Checking prereqs..."
command -v git >/dev/null 2>&1 || { err "git not found. Install Xcode Command Line Tools: xcode-select --install"; exit 1; }

if ! command -v node >/dev/null 2>&1; then
  err "node not found."
  echo "Install nvm + node 24:"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
  echo "  source ~/.zshrc"
  echo "  nvm install 24"
  echo "Then re-run this script."
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//;s/\..*//')
if [ "$NODE_VERSION" -lt 20 ]; then
  err "node $NODE_VERSION found, need 20+"
  exit 1
fi
ok "node $(node -v) and npm $(npm -v) ready"

NODE_PATH=$(which node)
NPM_PATH=$(which npm)

# ---- 2. Clone or update --------------------------------------------------
if [ ! -d "$INSTALL_DIR/.git" ]; then
  step "Cloning $REPO_URL to $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
else
  step "Pulling latest from $INSTALL_DIR..."
  git -C "$INSTALL_DIR" pull --ff-only
fi
cd "$INSTALL_DIR"

# ---- 3. Install deps -----------------------------------------------------
step "Installing npm dependencies..."
npm install --silent

step "Installing Playwright Chromium..."
npx playwright install chromium

# ---- 4. .env bootstrap ---------------------------------------------------
if [ ! -f .env ]; then
  step "No .env found — copying from .env.example..."
  cp .env.example .env
  warn "Created a fresh .env with empty secrets. You MUST fill these in:"
  warn "  - GOOGLE_PLACES_API_KEY (for lead discovery)"
  warn "  - TRACKER_EMAIL + TRACKER_PASSWORD (your tracker login, NOT Gmail)"
  warn "  - STRIPE_SECRET_KEY (sk_test_... or sk_live_...)"
  warn "  - STRIPE_WEBHOOK_SECRET (whsec_...)"
  warn "  - PUBLIC_BASE_URL (e.g. https://sendprop.com)"
fi

# Auto-generate CRON_SECRET if missing
if ! grep -q "^CRON_SECRET=." .env 2>/dev/null; then
  CRON_SECRET=$(openssl rand -hex 32)
  if grep -q "^CRON_SECRET=" .env; then
    sed -i.bak "s|^CRON_SECRET=.*|CRON_SECRET=$CRON_SECRET|" .env
    rm .env.bak
  else
    echo "CRON_SECRET=$CRON_SECRET" >> .env
  fi
  ok "Generated CRON_SECRET ($(echo "$CRON_SECRET" | cut -c1-8)...)"
fi

CRON_SECRET=$(grep "^CRON_SECRET=" .env | cut -d= -f2-)

# ---- 5. Database ---------------------------------------------------------
step "Running Prisma migrations..."
npx prisma migrate deploy
npx prisma generate

# ---- 6. Build ------------------------------------------------------------
step "Building production bundle..."
npm run build

# ---- 7. launchd plists ---------------------------------------------------
step "Writing launchd plists..."
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENTS_DIR"

APP_PLIST="$LAUNCH_AGENTS_DIR/$APP_LABEL.plist"
cat > "$APP_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$APP_LABEL</string>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NPM_PATH</string>
        <string>start</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>$(dirname "$NODE_PATH"):/usr/local/bin:/usr/bin:/bin</string>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>3000</string>
    </dict>
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
EOF

CRON_PLIST="$LAUNCH_AGENTS_DIR/$CRON_LABEL.plist"
cat > "$CRON_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$CRON_LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/curl</string>
        <string>-sS</string>
        <string>-H</string>
        <string>Authorization: Bearer $CRON_SECRET</string>
        <string>http://localhost:3000/api/cron/follow-ups</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/dialer-cron.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/dialer-cron.err</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF

ok "Wrote $APP_PLIST"
ok "Wrote $CRON_PLIST"

# Reload (unload + load) so a re-run picks up changes
step "Loading launchd jobs..."
launchctl unload "$APP_PLIST" 2>/dev/null || true
launchctl unload "$CRON_PLIST" 2>/dev/null || true
launchctl load "$APP_PLIST"
launchctl load "$CRON_PLIST"
ok "launchd jobs loaded"

# ---- 8. Smoke test -------------------------------------------------------
step "Waiting 5 seconds for the app to start..."
sleep 5
if curl -sf http://localhost:3000/ >/dev/null; then
  ok "Dialer is responding on http://localhost:3000"
else
  warn "Dialer not yet responding. Check /tmp/dialer-app.err for errors."
fi

# ---- Final checklist -----------------------------------------------------
echo ""
green "═══════════════════════════════════════════════════════════════════"
green "  Dialer is installed and running on this Mac mini."
green "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Local:    http://localhost:3000"
echo "Logs:     tail -f /tmp/dialer-app.log"
echo "Errors:   tail -f /tmp/dialer-app.err"
echo ""
echo "Cron:     daily at 9 AM, hits /api/cron/follow-ups"
echo "Logs:     tail -f /tmp/dialer-cron.log"
echo ""
green "What's left to do (manual, can't be scripted):"
echo ""
echo "1. EDIT .env to fill in real secrets:"
echo "   nano $INSTALL_DIR/.env"
echo "   - GOOGLE_PLACES_API_KEY"
echo "   - TRACKER_EMAIL / TRACKER_PASSWORD (tracker login, not Gmail)"
echo "   - STRIPE_SECRET_KEY (from https://dashboard.stripe.com/apikeys)"
echo "   - STRIPE_WEBHOOK_SECRET (from https://dashboard.stripe.com/webhooks)"
echo "   - PUBLIC_BASE_URL=https://sendprop.com"
echo ""
echo "2. CLOUDFLARE TUNNEL — point sendprop.com → localhost:3000"
echo "   - Cloudflare dashboard → Zero Trust → Networks → Tunnels"
echo "   - Edit your existing tunnel (the one serving email.buggers.online)"
echo "   - Public Hostnames → Add: sendprop.com → http://localhost:3000"
echo ""
echo "3. STRIPE WEBHOOK"
echo "   - https://dashboard.stripe.com/webhooks → Add endpoint"
echo "   - URL: https://sendprop.com/api/stripe/webhook"
echo "   - Events: checkout.session.completed, charge.refunded"
echo "   - Copy signing secret into .env as STRIPE_WEBHOOK_SECRET"
echo ""
echo "4. RESTART the dialer after editing .env:"
echo "   launchctl unload ~/Library/LaunchAgents/$APP_LABEL.plist"
echo "   launchctl load ~/Library/LaunchAgents/$APP_LABEL.plist"
echo ""
echo "5. TEST the funnel: visit https://sendprop.com/audit"
echo "   Use Stripe test card 4242 4242 4242 4242 to verify payment flow."
echo ""
green "Done. Re-run this script (\`bash scripts/deploy-to-mini.sh\`) any time"
green "you pull updates from GitHub — it's idempotent."

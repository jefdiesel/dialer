// Probe the email.buggers.online tracker API to discover the response
// shape of /api/track/emails. Run with TRACKER_EMAIL + TRACKER_PASSWORD set
// in .env. Outputs JSON to stdout — paste it back so we can wire up reply
// detection accurately.
//
//   node scripts/probe_tracker_api.mjs

import { readFileSync } from "node:fs";

// Tiny .env loader so we don't depend on dotenv
const env = {};
for (const line of readFileSync("./.env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?(.*?)["']?\s*$/);
  if (m) env[m[1]] = m[2];
}
const BASE = env.TRACKER_BASE_URL || "https://email.buggers.online";
const EMAIL = env.TRACKER_EMAIL;
const PASSWORD = env.TRACKER_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("set TRACKER_EMAIL + TRACKER_PASSWORD in .env first");
  process.exit(1);
}

console.log(`logging into ${BASE}...`);
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!loginRes.ok) {
  console.error(`login failed: ${loginRes.status} ${await loginRes.text()}`);
  process.exit(1);
}
const auth = await loginRes.json();
const token = auth.accessToken;
if (!token) {
  console.error("no accessToken in login response:", JSON.stringify(auth, null, 2));
  process.exit(1);
}
console.log(`got accessToken (${token.length} chars)`);

const probes = [
  ["/api/auth/me", "GET"],
  ["/api/track/emails", "GET"],
  ["/api/track/stats", "GET"],
  ["/api/gmail/status", "GET"],
];

for (const [path, method] of probes) {
  console.log(`\n=== ${method} ${path} ===`);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
    });
    console.log(`status: ${r.status}`);
    const text = await r.text();
    try {
      const j = JSON.parse(text);
      const summary = JSON.stringify(j, null, 2);
      console.log(summary.length > 4000 ? summary.slice(0, 4000) + "\n... (truncated)" : summary);
    } catch {
      console.log(text.slice(0, 500));
    }
  } catch (e) {
    console.error(`error: ${e.message}`);
  }
}

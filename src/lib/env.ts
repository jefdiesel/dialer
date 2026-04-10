// Centralized env access. Throws on read if missing — never at import time —
// so the dev server still boots when a key isn't set yet.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  get GOOGLE_PLACES_API_KEY() {
    return required("GOOGLE_PLACES_API_KEY");
  },
  get TRACKER_BASE_URL() {
    return process.env.TRACKER_BASE_URL ?? "https://email.buggers.online";
  },
};

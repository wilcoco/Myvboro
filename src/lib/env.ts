// Typed access to env vars with sane defaults. Single source of truth for
// economy knobs so we can move them to DB later without grep-and-replace.

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-change-me-please-32-bytes!!",
  publicAppUrl: process.env.PUBLIC_APP_URL || "http://localhost:3000",
  smsProvider: (process.env.SMS_PROVIDER || "mock") as "mock" | "twilio" | "aligo",

  signupPointsGrant: int("SIGNUP_POINTS_GRANT", 1000),
  dailyPointsGrant: int("DAILY_POINTS_GRANT", 50),
  placeCreateCost: int("PLACE_CREATE_COST", 100),

  // Caps for invest action — see lib/invest.ts.
  // New accounts (< 7 days old) can invest at most this fraction of the
  // place's current pool per single action.
  newAccountMaxShareFraction: 0.2,
  // Established accounts: looser cap.
  maxShareFraction: 0.5,
  // Min lockup after investing, in days. Informational in MVP (we don't
  // permit withdrawal anyway).
  lockupDays: 30,
  // Min account age (days) to be allowed to invest at all.
  minAccountAgeDaysToInvest: 0,

  // Map
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "",

  // R2
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucket: process.env.R2_BUCKET || "myvboro-photos",
    publicUrl: process.env.R2_PUBLIC_URL || "",
  },
};

export const r2Enabled = Boolean(
  env.r2.accountId && env.r2.accessKeyId && env.r2.secretAccessKey,
);

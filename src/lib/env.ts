// Typed access to env vars with sane defaults. Single source of truth for
// economy knobs so we can move them to DB later without grep-and-replace.

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

// SMS provider must be explicit in production. The mock provider performs
// auto-signin with no verification (see send-otp route); allowing it as a
// silent default in prod would mean any unset deploy is an auth-bypass.
//
// Escape hatch for staging / single-tester demo deploys:
//   ALLOW_MOCK_SMS_IN_PROD=true
// Set it explicitly when you're knowingly running prod without real SMS.
// This is opt-in by name so nobody trips into it.
//
// Guard with `typeof window === "undefined"` because env.ts ends up in the
// client bundle (via mapStyle.ts → MapCanvas) and the client always sees
// SMS_PROVIDER undefined / NODE_ENV inlined as "production" — without the
// guard the check would crash the browser, not just the server.
const rawSmsProvider = process.env.SMS_PROVIDER || "mock";
const mockAllowedInProd = process.env.ALLOW_MOCK_SMS_IN_PROD === "true";
if (
  typeof window === "undefined" &&
  process.env.NODE_ENV === "production" &&
  rawSmsProvider === "mock" &&
  !mockAllowedInProd
) {
  throw new Error(
    "SMS_PROVIDER is 'mock' in production. Either set SMS_PROVIDER=twilio (or " +
      "aligo) or, for a staging/demo deploy you're knowingly running without " +
      "real SMS, set ALLOW_MOCK_SMS_IN_PROD=true.",
  );
}

export const env = {
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-change-me-please-32-bytes!!",
  publicAppUrl: process.env.PUBLIC_APP_URL || "http://localhost:3000",
  smsProvider: rawSmsProvider as "mock" | "twilio" | "aligo",

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

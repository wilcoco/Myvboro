# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The product in one paragraph

myvboro is a map of restaurants/places where data is created by user **investment**, not check-ins or external POI feeds. The whole project is built around a **VC-style seed dilution game**: when a user invests N points into a place, that N is distributed pro-rata to all prior investors by their share of the pool *before* the new investment. First discoverers win big from follow-on investors; late investors only profit if more come after them. All "money" is in-game points — there is no cash-out path, by design (regulatory firewall vs. 자본시장법 투자계약증권 / sec laws). This mechanic is the heart of the codebase and the answer to the cold-start problem: people race to find hidden gems before others do.

Concrete example (the canonical math that must hold):
```
U1 invests 100         → pool 100,    holdings U1: 100%
U2 invests 200, U1 ← 200 (dividend)  → pool 300, U1: 1/3 U2: 2/3
U3 invests 300, U1 ← 100 U2 ← 200    → pool 600, U1: 1/6 U2: 2/6 U3: 3/6
```

If a change ever breaks this distribution, the project's premise is broken.

## Commands

```bash
npm run dev                # Next dev server (http://localhost:3000)
npm run build              # prisma generate + next build
npm run start              # next start; honors PORT env
npm run typecheck          # tsc --noEmit
npm run lint               # next lint
npm run db:migrate:dev     # apply migrations to local DB + regenerate client
npm run db:migrate:deploy  # apply migrations to a live DB (used by Railway)
npm run db:studio          # Prisma Studio

# Deploy on Railway runs:  scripts/start.sh  (retry-migrate, then `next start`)
```

There is no test suite yet — don't add one unless asked. If you need to verify a change to `lib/invest.ts`, run a one-off script against a local Postgres rather than adding scaffolding.

## Architecture: where to look first

- **`src/lib/invest.ts`** — `investInPlace` is the heart. The whole transaction (deduct payer, create Investment row, pay dividends to prior investors, update Place aggregates) must stay atomic in a single `prisma.$transaction`. The dividend math is `floor(newAmount * priorAmount / poolBefore)`. The `floor` matters — it slightly favors the pool over investors and prevents drift; do not change to round.
- **`prisma/schema.prisma`** — `Investment` is the cause-event; `Dividend` is the ledger row each cause produces against each prior holder. Equity is **never stored**; it is always derived as `userInvestmentSum / Place.totalInvestment` at read time.
- **`src/lib/places.ts`** — All spatial queries are bounding-box pre-filter on indexed `(centroidLat, centroidLng)` then haversine in raw SQL. **There is no PostGIS.** That decision is permanent unless we migrate off Railway's default Postgres image — see "Why no PostGIS" below.
- **`src/lib/session.ts`** — Opaque server-issued tokens stored in the `Session` table + httpOnly cookie. Not stateless JWTs. We do this on purpose: revocable, observable, and the `deviceFingerprint` column on `Session`+`DeviceLink` powers the sybil heuristic in `src/lib/sybil.ts`.
- **`src/lib/sybil.ts`** — Heuristic suspicion score. Notably: high ratio of self-investment (investing in places you created), and the same device fingerprint linked to multiple users, both raise the score. The cap in `invest.ts` is tightened for high-suspicion accounts.

## Non-obvious decisions

### Why no PostGIS
Railway's default Postgres image does not include PostGIS, so `CREATE EXTENSION postgis` fails at deploy time and the migration locks the database (P3009 forever after). Earlier branches used `geography(POINT, 4326)` with `Unsupported(...)` in Prisma; that path is dead. If you re-introduce spatial indexing, do it via S2/H3 cell IDs in plain int columns, not PostGIS — unless the deploy target also changes.

### Why phone OTP instead of email/OAuth
Phone uniqueness is the Sybil baseline. One verified number = one account. Without it, the entire investment game is exploitable by dummy accounts.

### Why `SMS_PROVIDER=mock` short-circuits the whole flow
With the mock provider, `/api/auth/send-otp` creates the session immediately and returns `{ autoSignedIn: true }` — there is no second screen. The point of the mock provider is to not block dev/staging logins; nobody actually receives SMS in mock mode and forcing the OTP step just made testers dig through Railway logs to find a code that exists only there. When `SMS_PROVIDER` is set to `twilio` or `aligo`, the real two-step flow kicks in untouched.

### Why `next/dynamic({ ssr: false })` around MapCanvas
MapLibre touches `window`, `document`, and `navigator.geolocation` at load and at runtime. Server-rendering a stub and then mounting the canvas client-side produced React #418/#423 hydration errors in production. The dynamic-import shim lives in `src/app/map/MapCanvasClient.tsx`; never import `MapCanvas` directly from a server component.

### Why all rewards are points-only (and you must not change this)
The dilution mechanic, taken with a cash-out, fits the Howey test and 자본시장법's definition of 투자계약증권. Keeping rewards bounded to in-game points (no exchange to KRW / vouchers / crypto) is what makes this a game rather than an unregistered security. Do not add a withdrawal endpoint, a points-to-cash converter, or a public points marketplace without explicit legal review.

## Railway deploy gotchas (will hit again)

- **Don't use `npm ci`**: we do not commit a lockfile in this repo; `nixpacks.toml` and `railway.json` use `npm install`. If a lockfile is added later, switch to `npm ci --include=dev` for reproducibility.
- **First-deploy migrate races IPv6 readiness**: `postgres.railway.internal` is IPv6-only and the container's network stack often isn't ready when the start command fires. `scripts/start.sh` retries `prisma migrate deploy` up to 20× (3 s apart) before giving up. Don't replace that with a single `&&` chain.
- **Failed migrations stick**: once a migration errors against the live DB, Prisma refuses every subsequent deploy (P3009). The fix is to reset the Postgres service or manually drop the row from `_prisma_migrations`. Mention this to the user before they spend an hour debugging "why won't the new code deploy."
- **Railway security scan blocks deploy on critical CVEs in deps**: keep `next` pinned to a version that's clear of the current advisories list (right now `^15.1.11`).
- **`NEXT_PUBLIC_*` is baked at build time**: changing them requires a redeploy, not just a restart. Empty values still get inlined — the map style code checks `token.startsWith("pk.")` precisely because Railway's empty-string env vars used to pass a naive truthy check.

## Env vars (the live set, in priority order)

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | On Railway, set as `${{Postgres.DATABASE_URL}}` reference |
| `SESSION_SECRET` | yes | `openssl rand -base64 32` |
| `PUBLIC_APP_URL` | yes | Full origin including scheme |
| `SMS_PROVIDER` | yes | `mock` until a real provider is wired |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | no | If empty/invalid → CARTO Dark Matter fallback |
| `SIGNUP_POINTS_GRANT` / `DAILY_POINTS_GRANT` / `PLACE_CREATE_COST` | no | Economy knobs; defaults in `src/lib/env.ts` |
| `R2_*` (4 vars) | no | Photo uploads stub themselves out when unset |

## What is intentionally missing (don't "fix" by adding)

- next-intl / i18n — Korean-only for MVP. Re-add when expanding regions.
- next-auth — we roll our own phone OTP + session.
- A photo dedup pipeline (dHash etc.) — was in the prior implementation, removed in the rewrite. Comes back in v0.5.
- AI menu matching / receipt OCR — v1 / v2 features.
- A test framework — see Commands section.

## When changing the investment math

Open `src/lib/invest.ts` and `prisma/schema.prisma` together. Anything that touches the dividend formula or the order of operations inside `prisma.$transaction` is load-bearing for the product's premise (see the canonical math at the top of this file). If you change it, walk through the U1/U2/U3 example by hand and confirm the resulting balances and equities match.

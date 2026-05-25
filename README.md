# myvboro

> 사용자가 직접 발견하고 **투자**하는 동네 가게 지도. 외부 POI 없음. 광고 없음.

핵심 메커니즘은 **VC 시드 라운드 dilution 게임**입니다.

- 새 가게를 등록하면 자동으로 첫 투자자가 됩니다.
- 후속 투자자가 같은 가게에 투자하면, 그 금액은 **기존 투자자에게 지분 비율대로 분배**됩니다.
- 콜드스타트 문제는 "먼저 발견할수록 더 많이 번다"는 비대칭 보상으로 해결됩니다.
- 모든 보상은 **게임 내 포인트**입니다. 현금 환금 없음 → 사행성/증권 회피.

## 분배 예시

| 시점 | 신규 투자 | 분배 | 풀 | 지분 (U1, U2, U3) |
|---|---|---|---|---|
| 0 | U1: 100 | — | 100 | 100% / — / — |
| 1 | U2: 200 | U1 ← 200 | 300 | 1/3 / 2/3 / — |
| 2 | U3: 300 | U1 ← 100, U2 ← 200 | 600 | 1/6 / 2/6 / 3/6 |

손익 누적:

- U1: -100 + 200 + 100 = **+200**
- U2: -200 + 200 = **0** (지분 2/6 보유)
- U3: -300 (지분 3/6 보유, 다음 투자자 기다림)

---

## Stack

| Layer        | Tech                                               |
|--------------|----------------------------------------------------|
| Framework    | Next.js 15 (App Router) + React 19 + TypeScript    |
| Styling      | Tailwind CSS                                       |
| Map          | MapLibre GL JS + Mapbox raster tiles (OSM fallback)|
| Auth         | Phone OTP (mock SMS by default; rotates to Twilio/Aligo) |
| DB           | PostgreSQL (plain — no PostGIS dep)                |
| ORM          | Prisma; spatial queries via haversine in raw SQL   |
| Storage      | Cloudflare R2 (optional in dev)                    |
| Deploy       | Railway (nixpacks)                                 |

Deliberately **not** used: Foursquare / Google Places / Kakao / Naver. POIs
emerge from user investment, not external feeds.

---

## Local development

```bash
# 1. Install
npm install

# 2. Env
cp .env.example .env
#   - DATABASE_URL  (Postgres w/ PostGIS — Railway plugin or local postgis/postgis Docker image)
#   - SESSION_SECRET=$(openssl rand -base64 32)
#   - SMS_PROVIDER=mock                  (OTP printed to server log)
#   - NEXT_PUBLIC_MAPBOX_TOKEN=...       (optional; falls back to OSM)

# 3. Migrate
npm run db:migrate:dev

# 4. Run
npm run dev
# → http://localhost:3000
```

### Sign in (dev mode, no SMS)

1. Visit `/signin`, enter any Korean mobile number (e.g. `010-1234-5678`).
2. Check the **server console** for a line like
   `[SMS MOCK] -> +821012345678   [myvboro] 인증번호: 123456`.
3. Enter that code in the UI.

---

## Project layout

```
src/
├─ app/
│  ├─ api/
│  │  ├─ auth/{send-otp,verify-otp,signout}/route.ts
│  │  ├─ places/route.ts                     # GET nearby/bbox, POST create+invest
│  │  ├─ places/[id]/route.ts                # GET detail
│  │  ├─ places/[id]/invest/route.ts         # POST invest (dilution)
│  │  ├─ visits/route.ts                     # POST a visit
│  │  ├─ photos/presign/route.ts             # POST -> R2 presigned URL
│  │  ├─ me/route.ts                         # GET current user + portfolio totals
│  │  ├─ me/investments/route.ts             # GET per-place holdings
│  │  └─ health/route.ts                     # Railway healthcheck
│  ├─ map/page.tsx
│  ├─ places/[id]/page.tsx
│  ├─ places/new/page.tsx
│  ├─ profile/page.tsx
│  ├─ signin/page.tsx
│  ├─ layout.tsx
│  └─ page.tsx                                # landing
├─ components/
│  ├─ MapCanvas.tsx
│  ├─ SignInForm.tsx · SignOutButton.tsx
│  ├─ AddPlaceForm.tsx
│  ├─ InvestForm.tsx · InvestorsTable.tsx
├─ lib/
│  ├─ prisma.ts · env.ts · utils.ts
│  ├─ session.ts        # opaque session cookies + DB
│  ├─ sms.ts · otp.ts   # SMS gateway + OTP issue/verify
│  ├─ places.ts         # PostGIS queries (ST_DWithin, ST_MakeEnvelope)
│  ├─ scoring.ts        # tier ladder, time decay, place aggregates
│  ├─ invest.ts         # ★ dilutive distribution mechanic
│  ├─ economy.ts        # signup/daily point grants
│  ├─ sybil.ts          # device fingerprint + self-invest heuristics
│  ├─ r2.ts             # Cloudflare R2 presign
│  └─ mapStyle.ts       # MapLibre style (Mapbox or OSM)
└─ middleware.ts        # cookie-presence gate for /profile, /places/new

prisma/
├─ schema.prisma
└─ migrations/
   └─ 1_init/                   # base tables, indexes, FKs (no PostGIS)
```

Spatial queries (`findNearbyPlaces`, `findPlacesInBbox`) use a bounding-box
pre-filter on `(centroidLat, centroidLng)` + haversine in raw SQL. See
`src/lib/places.ts`. Fast enough for ~100k places per region; swap in
PostGIS or S2/H3 later if needed.

---

## Deployment (Railway)

1. **Provision Postgres** (Railway → `+ New` → Database → PostgreSQL).
   Plain Postgres — no PostGIS required.
2. **Add this repo as a service.** Railway picks up `nixpacks.toml` and
   `railway.json` automatically.
3. **Set env vars** in the Railway service:
   - `DATABASE_URL` — linked from the Postgres plugin
   - `SESSION_SECRET` — `openssl rand -base64 32`
   - `PUBLIC_APP_URL` — e.g. `https://myvboro.up.railway.app`
   - `NEXT_PUBLIC_MAPBOX_TOKEN` — optional
   - `SMS_PROVIDER` — leave as `mock` until you wire a real provider
4. Build runs `prisma generate && next build`. Start runs
   `prisma migrate deploy && next start`. The `/api/health` endpoint is
   the Railway healthcheck target.

### Common Railway gotchas

- **Build OOM** — Next 15 builds are heavy. Bump Railway plan, or set
  `NODE_OPTIONS=--max-old-space-size=2048`.
- **`Can't reach database server`** — `DATABASE_URL` not linked.
- **`directUrl` errors** — Railway's plain Postgres has no pooler; do not
  set `DIRECT_URL` / `directUrl` unless you swap to PgBouncer.
- **`prisma generate` missing on cold deploy** — covered by both
  `postinstall` and the explicit nixpacks build step.

---

## Roadmap (excerpt)

- **v0 (this branch)** — phone OTP, map, place create+invest, dilution math,
  portfolio, sybil heuristics.
- **v0.5** — photo upload to R2, perceptual-hash dedup, in-app camera tier.
- **v1** — receipt OCR (tier 5), gate momentum/lockup display, multilingual
  alias clustering.
- **v2** — paid "Michelin evaluator" requests (revenue model #1), restaurant
  owner verification + reservation/discount features (revenue model #2).

---

## Guardrails

- All distributed dividends are in-game points; **no cash-out path** exists
  in code. Don't add one without legal review (자본시장법 투자계약증권 해석).
- Per-action share cap, per-day invest cap, and account-age gate live in
  `src/lib/invest.ts`. Tune via `src/lib/env.ts`.
- Device fingerprint × user link is recorded on each login. Many users on
  one fingerprint → `suspicionScore` rises → invest tightens.

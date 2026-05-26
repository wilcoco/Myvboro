# myvboro

Trust-based local knowledge service. Places emerge from real visits (photo +
GPS + dwell time + repeat visits), not from external POI APIs or paid
listings. The map uses **circles, not pins** — radius encodes location
uncertainty, color intensity encodes confidence.

> 광고가 구조적으로 끼지 못하는 동네 지도. AI × Foursquare × Stack Overflow.

See [`PROJECT.md`](./PROJECT.md) once it lands, or the kickoff brief in the
project history, for the full concept (territory game mechanics, 7-tier
proof ladder, endorsement loop, anti-ads by construction).

---

## Stack

| Layer        | Tech                                               |
|--------------|----------------------------------------------------|
| Framework    | Next.js 15 (App Router) + TypeScript               |
| Styling      | Tailwind CSS + shadcn/ui primitives                |
| i18n         | `next-intl` — `/en` and `/ko` from day one         |
| Map          | Custom Canvas renderer pulling OSM raster tiles    |
| Auth         | Auth.js v5 (Google + Resend magic link)            |
| DB           | PostgreSQL + PostGIS (`geography(POINT, 4326)`)    |
| ORM          | Prisma (PostGIS via raw SQL migrations)            |
| Storage      | Cloudflare R2 (photos)                             |
| Deploy       | Railway (nixpacks)                                 |
| Mobile       | PWA first; React Native later                      |

Deliberately **not** used: Foursquare / Google Places API, kakaomap,
naver map. POIs are built from user evidence — that's the whole point.

---

## Getting started

```bash
# 1. Install
npm install

# 2. Set up env
cp .env.example .env
#   - DATABASE_URL (Railway Postgres, PostGIS-enabled)
#   - AUTH_SECRET=$(openssl rand -base64 32)
#   - AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
#   - AUTH_RESEND_KEY / AUTH_RESEND_FROM
#   - (Map needs no key — OSM raster tiles are pulled directly; not
#     production-grade per OSM tile usage policy.)

# 3. Database — applies the PostGIS extension + Prisma schema
npm run db:migrate:dev

# 4. Dev server
npm run dev
# → http://localhost:3000  (redirects to /en)
```

---

## Project layout

```
src/
├─ app/
│  ├─ [locale]/
│  │  ├─ layout.tsx        # html/body + NextIntlClientProvider
│  │  ├─ page.tsx          # landing
│  │  ├─ map/page.tsx      # MapLibre canvas
│  │  └─ signin/           # Auth.js sign-in pages
│  ├─ api/auth/[...nextauth]/route.ts
│  └─ not-found.tsx
├─ components/
│  ├─ MapCanvas.tsx        # main map shell (OSM-backed)
│  └─ OSMMap.tsx           # Canvas tile renderer + pan/zoom/circles
├─ i18n/
│  ├─ routing.ts           # locales, navigation helpers
│  └─ request.ts           # message loader
├─ messages/
│  ├─ en.json
│  └─ ko.json
├─ lib/
│  ├─ prisma.ts
│  └─ utils.ts
├─ auth.ts                 # NextAuth config
└─ middleware.ts           # next-intl locale routing

prisma/
├─ schema.prisma           # User / Place / Visit / Photo / Endorsement / PlaceMerge
└─ migrations/
   ├─ 00000000000000_postgis/         # CREATE EXTENSION postgis
   └─ 00000000000001_postgis_indexes/ # GIST indexes + sync triggers
```

---

## Deployment (Railway)

1. **Provision Postgres** (Railway → `+ New` → Database → PostgreSQL).
   PostGIS is enabled by the first migration (`CREATE EXTENSION postgis`).
2. **Add this repo as a service.** Railway picks up `nixpacks.toml` and
   `railway.json` automatically. Build runs `prisma generate && next build`;
   start runs `prisma migrate deploy && next start`.
3. **Set env vars** in the Railway service: everything in `.env.example`,
   plus `DATABASE_URL` linked from the Postgres plugin.

---

## Roadmap (excerpt)

- **v1 (current)** — register, search, profile; tier 0–3 proofs; basic
  authority score; "queue up" button.
- **v1.5** — perceptual-hash photo dedup, AI menu match (tier 4),
  multilingual alias clustering.
- **v2** — receipt OCR (tier 5), CLIP-based auto merge/split, knowledge
  map (category-based), Place-scoped AI chat.
- **v3+** — open-banking integration where available, territory game
  seasons, private team territories.

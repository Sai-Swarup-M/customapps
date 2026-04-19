# Design Document — Grocery Deals Tracker

**Status:** Awaiting Sign-off
**Phase:** 2 — Design
**Last Updated:** 2026-04-19

---

## 1. Architecture Overview

Single Next.js 15 application (frontend + backend in one repo) deployed on Vercel.
No separate backend service — API routes run as Vercel serverless functions.

```
iPhone (PWA / iOS Shortcut)
        │
        ▼
   Vercel (Next.js 15)
   ┌─────────────────────────────────┐
   │  App Router (UI)                │
   │  API Routes (serverless)        │
   │    /api/upload                  │
   │    /api/chat                    │
   │    /api/deals/*                 │
   │    /api/push/*                  │
   │    /api/cron/weekly-digest      │
   └────────────┬────────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
   Supabase         Claude API
   PostgreSQL        (Vision + Chat)
   Storage
   (ad images)
```

---

## 2. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 15 (App Router) | Full-stack in one repo, Vercel-native, PWA support |
| Language | TypeScript (strict) | Type safety across DB schema → API → UI |
| Styling | Tailwind CSS | Fast mobile-first UI, no bloat |
| Database | Supabase (PostgreSQL) | Free tier, real-time, built-in Storage, Row Level Security |
| Image Storage | Supabase Storage | Store original ad images alongside data |
| AI Vision | Claude API `claude-sonnet-4-6` | Best-in-class at reading complex ad layouts |
| AI Chat | Claude API `claude-sonnet-4-6` | Natural language deal queries |
| Hosting | Vercel free tier | Zero-config deployment, cron jobs built-in |
| Push Notifications | Web Push API + Vercel Cron | Weekly digest to iPhone (iOS 16.4+) |
| iOS Automation | iOS Shortcuts | Auto-upload screenshots on iPhone |

**Rejected alternatives:**
- Separate Express/FastAPI backend — unnecessary complexity for this scale
- OpenAI Vision — weaker than Claude at structured extraction from messy layouts
- Firebase — more expensive, less SQL-friendly for price comparisons

---

## 3. Data Schema

```sql
-- Stores (one row per grocery store)
CREATE TABLE stores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,          -- "Big Bazaar"
  address     TEXT,                   -- extracted from ad image
  website     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Weekly ad images uploaded by user
CREATE TABLE ads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID REFERENCES stores(id),
  image_url        TEXT NOT NULL,     -- Supabase Storage URL
  sale_start_date  DATE,
  sale_end_date    DATE,
  raw_extraction   JSONB,             -- full Claude response, for debugging
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Normalized product names for cross-store comparison
-- e.g. "India Gate Basmati Rice 20LB" and "Laxmi Basmati Rice" → name="Basmati Rice", brand="India Gate" / "Laxmi"
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,          -- "Basmati Rice", "Green Beans" (brand-agnostic)
  brand       TEXT,                   -- "India Gate", "Laxmi", "Swagat", null for produce
  category    TEXT,                   -- "Fresh Produce", "Dry Products"
  UNIQUE (name, brand),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Individual deal lines extracted from each ad
CREATE TABLE deals (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id                   UUID REFERENCES ads(id),
  store_id                UUID REFERENCES stores(id),
  product_id              UUID REFERENCES products(id),

  -- Raw data as it appeared in the ad
  raw_name                TEXT NOT NULL,       -- "India Gate Basmati Rice"
  price                   NUMERIC(10,2) NOT NULL,
  unit                    TEXT NOT NULL,       -- "/4LB", "/LB", "/KG", "/EACH"

  -- Normalized for comparison
  base_unit               TEXT,               -- "LB", "KG", "EACH", "BUNCH"
  package_quantity        NUMERIC,            -- 4 (for "/4LB"), 20 (for "/20LB")
  price_per_base_unit     NUMERIC(10,2),      -- price / package_quantity

  -- Multi-buy deals (e.g. "BUY 2 FOR $6.00")
  deal_type               TEXT DEFAULT 'regular', -- 'regular', 'multi_buy', 'bogo'
  multi_buy_qty           INT,
  multi_buy_price         NUMERIC(10,2),
  effective_unit_price    NUMERIC(10,2),      -- best per-unit price including deal

  -- Date range this deal is valid
  sale_start_date         DATE,
  sale_end_date           DATE,

  created_at              TIMESTAMPTZ DEFAULT now()
);

-- Web Push subscriptions (for weekly notifications)
CREATE TABLE push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription  JSONB NOT NULL,    -- Web Push subscription object
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. Unit Normalization Rules

Converting all prices to a comparable price-per-base-unit:

| Ad Unit | Example | Logic | Result |
|---------|---------|-------|--------|
| `/LB` | $1.49/LB | price ÷ 1 | $1.49/LB |
| `/4LB` | $5.49/4LB | price ÷ 4 | $1.37/LB |
| `/20LB` | $17.99/20LB | price ÷ 20 | $0.90/LB |
| `/40LB` | $21.99/40LB | price ÷ 40 | $0.55/LB |
| `/KG` | $3.49/KG | price ÷ 2.205 | $1.58/LB |
| `/1KG` | $3.99/1KG | price ÷ 2.205 | $1.81/LB |
| `/2LB` | $8.99/2LB | price ÷ 2 | $4.50/LB |
| `BUY 2 FOR $6` | multi_buy | $6 ÷ 2 | $3.00/each |
| `2 FOR $5` | multi_buy | $5 ÷ 2 | $2.50/each |
| `/EACH`, `/BUNCH`, `/9CT` | non-weight | no normalization | show as-is |

---

## 5. API Contracts

### `POST /api/upload`
Upload an ad image. Called by iOS Shortcut or PWA upload form.

**Auth:** `Authorization: Bearer {UPLOAD_API_KEY}` (env var)

**Request:** `multipart/form-data`
```
image: <file>
```

**Response:**
```json
{
  "ad_id": "uuid",
  "store": "Big Bazaar",
  "sale_dates": { "start": "2026-04-17", "end": "2026-04-19" },
  "products_found": 32,
  "status": "processed"
}
```

**Internal flow:**
1. Upload image → Supabase Storage
2. Send image to Claude Vision with extraction prompt
3. Parse Claude JSON response
4. Upsert store → insert ad → normalize + insert deals

---

### `POST /api/chat`
Natural language query against the deals database.

**Request:**
```json
{ "message": "What is the best price for basmati rice this week?" }
```

**Response:**
```json
{
  "answer": "India Gate Basmati Rice 20LB is $17.99 at Patel Brothers ($0.90/LB), vs $21.99 at Big Bazaar ($1.10/LB). Patel Brothers wins by 18%.",
  "deals": [ ... ]
}
```

**Internal flow:**
1. Extract product/intent from message using Claude
2. Query `deals` table for matching products within current sale dates
3. Pass results as context back to Claude
4. Return natural language answer + raw deal rows

---

### `GET /api/deals/top?limit=10&category=all`
Returns top deals ranked by best effective price vs. typical market price.

### `GET /api/deals/compare?product=basmati+rice`
Returns all matching deals across all stores, sorted by `effective_unit_price`.

### `GET /api/deals/current`
All deals with `sale_end_date >= today`.

### `POST /api/push/subscribe`
Saves a Web Push subscription for weekly notifications.

### `GET /api/cron/weekly-digest` *(Vercel Cron — runs every Sunday 9am)*
Queries top 10 deals, sends Web Push to all subscribers.

---

## 6. Claude Vision Extraction Prompt

```
You are a grocery ad data extractor. Extract ALL products and prices from this ad image.

Return ONLY valid JSON in this exact structure:
{
  "store_name": "string",
  "store_address": "string or null",
  "store_website": "string or null",
  "sale_start_date": "YYYY-MM-DD or null",
  "sale_end_date": "YYYY-MM-DD or null",
  "products": [
    {
      "raw_name": "exact product name from ad",
      "category": "Fresh Produce | Dry Products | Dairy | Meat | Snacks | Beverages | Other",
      "normalized_name": "generic product name without brand or size (e.g. 'Basmati Rice', 'Green Beans')",
      "brand": "brand name only, or null for unbranded produce (e.g. 'India Gate', 'Laxmi', 'Swagat')",
      "price": 5.49,
      "unit": "4LB",
      "deal_type": "regular | multi_buy | bogo",
      "multi_buy_qty": null,
      "multi_buy_price": null
    }
  ]
}

Rules:
- Extract every product visible, even if price is small or partially obscured
- For "BUY 2 FOR $6.00": deal_type=multi_buy, multi_buy_qty=2, multi_buy_price=6.00, price=price of one
- For "2 FOR $5.00": same as above
- normalized_name should be brand-agnostic (omit brand, size, variety)
- Dates: infer year from context if not shown
- If a field is truly unknown, use null
```

---

## 7. Chat Query — Prompt Design

```
You are a helpful grocery deals assistant. Answer the user's question using ONLY
the deals data provided below. Be specific: include store name, price, unit, and
effective per-unit price. If comparing stores, clearly state which is better and by
how much. If no relevant deals are found, say so honestly.

Current date: {date}

Deals data:
{json_deals_from_db}

User question: {user_message}
```

---

## 8. iOS Shortcut Setup (documented for user)

One-time setup in iPhone Shortcuts app:

```
Trigger: "When photo added to album: Grocery Ads"

Actions:
1. Get variable: Shortcut Input (the new photo)
2. Get contents of URL:
     URL: https://your-app.vercel.app/api/upload
     Method: POST
     Headers: Authorization = Bearer {UPLOAD_API_KEY}
     Body: Form  →  image = [Shortcut Input]
3. Show notification: "Ad processed ✓ [store_name] — [products_found] products"
```

User workflow:
- Screenshot any ad → move to "Grocery Ads" album → done, runs automatically

---

## 9. PWA Configuration

```json
// public/manifest.json
{
  "name": "Grocery Deals",
  "short_name": "Deals",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#16a34a",
  "start_url": "/",
  "icons": [...]
}
```

Service Worker: caches last-loaded deals for offline access.

---

## 10. Security

| Concern | Approach |
|---------|----------|
| Upload endpoint | Bearer token (env var `UPLOAD_API_KEY`) |
| Claude API key | Server-side only, never exposed to client |
| Supabase keys | `SUPABASE_SERVICE_ROLE_KEY` server-side only; `SUPABASE_ANON_KEY` client-side with RLS |
| Image storage | Supabase Storage private bucket, signed URLs |
| Rate limiting | Vercel middleware: max 20 uploads/hour per IP |
| Secrets | All in `.env.local`, never committed |

No user authentication needed — personal/family app with a shared upload API key.

---

## 11. Project Structure

```
grocery-deals/
├── app/
│   ├── page.tsx                  # Home — current deals + top deals
│   ├── upload/page.tsx           # Manual upload UI
│   ├── chat/page.tsx             # Chat interface
│   ├── history/page.tsx          # Price history charts
│   └── api/
│       ├── upload/route.ts       # Image upload + Claude extraction
│       ├── chat/route.ts         # Natural language queries
│       ├── deals/
│       │   ├── top/route.ts
│       │   ├── current/route.ts
│       │   └── compare/route.ts
│       ├── push/subscribe/route.ts
│       └── cron/weekly-digest/route.ts
├── components/
│   ├── DealCard.tsx
│   ├── DealCompareTable.tsx
│   ├── ChatInterface.tsx
│   ├── UploadDropzone.tsx
│   └── PriceHistoryChart.tsx
├── lib/
│   ├── supabase.ts               # Supabase client
│   ├── claude.ts                 # Claude API client + prompts
│   ├── extract.ts                # Vision extraction pipeline
│   ├── normalize.ts              # Unit normalization logic
│   └── push.ts                   # Web Push utilities
├── docs/
│   ├── requirements.md
│   └── design.md                 # This file
├── public/
│   ├── manifest.json             # PWA manifest
│   └── sw.js                     # Service worker
├── .env.example
├── .env.local                    # Never committed
└── CLAUDE.md
```

---

## 12. Testing Strategy

| Layer | Tool | What |
|-------|------|------|
| Unit | Vitest | normalize.ts unit conversion logic |
| Unit | Vitest | Claude response parsing |
| Integration | Vitest + Supabase local | Upload pipeline end-to-end |
| E2E | Playwright | Upload → query flow on mobile viewport |

---

## 13. Deployment

```
git push → Vercel auto-deploys
Environment variables set in Vercel dashboard:
  ANTHROPIC_API_KEY
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  UPLOAD_API_KEY
  NEXT_PUBLIC_VAPID_PUBLIC_KEY
  VAPID_PRIVATE_KEY
```

Vercel Cron (in `vercel.json`):
```json
{ "crons": [{ "path": "/api/cron/weekly-digest", "schedule": "0 9 * * 0" }] }
```

---

## Sign-off

- [x] Design approved by user
- [x] Date: 2026-04-19

-- Grocery Deals Tracker — Initial Schema

CREATE TABLE stores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  address    TEXT,
  website    TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID REFERENCES stores(id) ON DELETE CASCADE,
  image_url        TEXT NOT NULL,
  sale_start_date  DATE,
  sale_end_date    DATE,
  raw_extraction   JSONB,
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  brand      TEXT,
  category   TEXT,
  UNIQUE (name, brand),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE deals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id                UUID REFERENCES ads(id) ON DELETE CASCADE,
  store_id             UUID REFERENCES stores(id) ON DELETE CASCADE,
  product_id           UUID REFERENCES products(id),
  raw_name             TEXT NOT NULL,
  price                NUMERIC(10,2) NOT NULL,
  unit                 TEXT NOT NULL,
  base_unit            TEXT,
  package_quantity     NUMERIC,
  price_per_base_unit  NUMERIC(10,2),
  deal_type            TEXT DEFAULT 'regular',
  multi_buy_qty        INT,
  multi_buy_price      NUMERIC(10,2),
  effective_unit_price NUMERIC(10,2),
  sale_start_date      DATE,
  sale_end_date        DATE,
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_deals_product_id   ON deals(product_id);
CREATE INDEX idx_deals_store_id     ON deals(store_id);
CREATE INDEX idx_deals_sale_dates   ON deals(sale_start_date, sale_end_date);
CREATE INDEX idx_products_name      ON products(name);
CREATE INDEX idx_products_brand     ON products(brand);

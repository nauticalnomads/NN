-- ─────────────────────────────────────────────────────────────────────────────
-- Nautical Nomads — 0001 init: extensions, enums, tables, indexes
-- Master architecture §4 data model. Versioned migration (no dashboard edits).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ── Enums ────────────────────────────────────────────────────────────────────
create type user_role as enum ('master', 'regular', 'content');
create type product_status as enum ('draft', 'published');
create type pod_provider as enum ('printful', 'printify');
create type order_status as enum (
  'pending',            -- created, not yet paid
  'paid',               -- payment confirmed (Stripe webhook)
  'awaiting_fulfilment',-- paid but auto-fulfilment paused (kill-switch)
  'fulfilling',         -- provider order(s) placed
  'shipped',
  'delivered',
  'fulfilment_failed',
  'cancelled',
  'refunded'
);
create type fulfilment_attempt_status as enum ('pending', 'success', 'failed');
create type refund_status as enum ('requested', 'processing', 'completed', 'failed', 'rejected');
create type shipping_mode as enum ('live', 'flat');
create type social_status as enum ('draft', 'scheduled', 'posted', 'failed');
create type blog_status as enum ('draft', 'scheduled', 'published', 'discarded');
create type blog_trigger as enum ('auto_new_product', 'auto_on_sale', 'manual_url');
create type notification_type as enum ('fulfilment_failed', 'refund_requested', 'dispute_opened');

-- ── updated_at trigger helper ────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── users (admin/staff; links to Supabase auth.users) ────────────────────────
create table users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        user_role not null default 'content',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger users_updated_at before update on users
  for each row execute function set_updated_at();

-- ── customers (optional accounts; guest orders store contact inline) ─────────
create table customers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users (id) on delete set null,
  email       text not null,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();

-- ── products ─────────────────────────────────────────────────────────────────
create table products (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  slug                text not null unique,
  description         text,
  status              product_status not null default 'draft',
  price               numeric(12, 2) not null default 0,
  compare_at_price    numeric(12, 2),               -- regular price; price < this ⇒ on sale
  currency            text not null default 'GBP',
  provider            pod_provider,                 -- §6 POD mapping (required to auto-publish)
  provider_product_id text,
  base_cost           numeric(12, 2),               -- what we pay the provider (COGS, estimate)
  seo_title           text,
  seo_description     text,
  sort_order          integer not null default 0,
  featured            boolean not null default false,
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

-- ── variants ──────────────────────────────────────────────────────────────────
create table variants (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references products (id) on delete cascade,
  title               text,                         -- e.g. "M / Faded Denim"
  size                text,
  color               text,
  sku                 text not null unique,         -- new clean SKU (NN-…)
  provider_variant_id text,                         -- §6 POD mapping
  price               numeric(12, 2) not null default 0,
  base_cost           numeric(12, 2),
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger variants_updated_at before update on variants
  for each row execute function set_updated_at();

-- ── collections + join ────────────────────────────────────────────────────────
create table collections (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  slug            text not null unique,
  description     text,
  status          product_status not null default 'published',
  seo_title       text,
  seo_description text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger collections_updated_at before update on collections
  for each row execute function set_updated_at();

create table collection_products (
  collection_id uuid not null references collections (id) on delete cascade,
  product_id    uuid not null references products (id) on delete cascade,
  sort_order    integer not null default 0,
  primary key (collection_id, product_id)
);

-- ── product images ──────────────────────────────────────────────────────────
create table product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  url         text not null,
  alt         text,                                 -- §5 SEO + feeds caption AI
  sort_order  integer not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── orders (immutable snapshot lives in order_items) ──────────────────────────
create table orders (
  id                         uuid primary key default gen_random_uuid(),
  order_number               text unique,
  customer_id                uuid references customers (id) on delete set null, -- null = guest
  email                      text not null,         -- captured first (abandoned cart + receipts)
  status                     order_status not null default 'pending',
  currency                   text not null default 'GBP',
  subtotal                   numeric(12, 2) not null default 0,
  shipping_total             numeric(12, 2) not null default 0,
  tax_total                  numeric(12, 2) not null default 0,  -- 0 while VAT off
  discount_total             numeric(12, 2) not null default 0,
  grand_total                numeric(12, 2) not null default 0,
  shipping_address           jsonb,
  billing_address            jsonb,
  shipping_quote             jsonb,                 -- captured quote (§6)
  shipping_mode              shipping_mode,         -- mode used at checkout
  stripe_payment_intent_id   text,
  stripe_checkout_session_id text,
  provider_orders            jsonb not null default '[]'::jsonb, -- [{provider,provider_order_id,status}]
  tracking                   jsonb not null default '[]'::jsonb, -- [{carrier,number,url,provider}]
  placed_at                  timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

-- ── order_items: IMMUTABLE snapshot of what was bought (master §4 golden rule) ─
create table order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders (id) on delete cascade,
  product_id          uuid references products (id) on delete set null, -- reference only
  variant_id          uuid references variants (id) on delete set null,
  title               text not null,                -- snapshot
  variant_title       text,
  sku                 text not null,                -- snapshot
  provider            pod_provider,
  provider_product_id text,
  provider_variant_id text,
  unit_price          numeric(12, 2) not null,      -- snapshot
  base_cost           numeric(12, 2),               -- snapshot for COGS
  quantity            integer not null check (quantity > 0),
  currency            text not null default 'GBP',
  created_at          timestamptz not null default now()
);

-- ── refunds ───────────────────────────────────────────────────────────────────
create table refunds (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders (id) on delete cascade,
  stripe_refund_id text,
  amount          numeric(12, 2) not null,
  currency        text not null default 'GBP',
  reason          text,
  note            text,
  status          refund_status not null default 'requested',
  requested_by    uuid references auth.users (id) on delete set null, -- customer (or null)
  actioned_by     uuid references auth.users (id) on delete set null, -- admin
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger refunds_updated_at before update on refunds
  for each row execute function set_updated_at();

-- ── settings (singletons via boolean PK = true) ───────────────────────────────
create table store_settings (
  id                      boolean primary key default true check (id),
  vat_enabled             boolean not null default false,   -- §7: OFF until registered
  vat_rate                numeric(5, 2) not null default 0,
  currency                text not null default 'GBP',
  brand_voice             text,                             -- §9.3 + examples (seeded)
  auto_fulfilment_enabled boolean not null default true,    -- kill-switch (§7/§B-07)
  fulfilment_dry_run      boolean not null default true,    -- no real POD orders until off
  make_webhook_url        text,
  social_config           jsonb not null default '{}'::jsonb,
  notification_prefs      jsonb not null default
    '{"fulfilment_failed": true, "refund_requested": true, "dispute_opened": true}'::jsonb,
  updated_at              timestamptz not null default now()
);
create trigger store_settings_updated_at before update on store_settings
  for each row execute function set_updated_at();

create table shipping_settings (
  id          boolean primary key default true check (id),
  mode        shipping_mode not null default 'live',
  flat_zones  jsonb not null default '[]'::jsonb,   -- [{name, countries:[…], rate}]
  updated_at  timestamptz not null default now()
);
create trigger shipping_settings_updated_at before update on shipping_settings
  for each row execute function set_updated_at();

-- ── marketing ──────────────────────────────────────────────────────────────────
create table social_drafts (
  id               uuid primary key default gen_random_uuid(),
  image_ref        text,                            -- Google Drive file id
  image_url        text,
  caption          text,
  status           social_status not null default 'draft',
  platform_targets text[] not null default '{}',
  scheduled_at     timestamptz,
  posted_at        timestamptz,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger social_drafts_updated_at before update on social_drafts
  for each row execute function set_updated_at();

create table blog_posts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  slug            text not null unique,
  body            text,
  excerpt         text,
  seo_title       text,
  seo_description text,
  status          blog_status not null default 'draft',
  trigger         blog_trigger,
  source_url      text,
  product_id      uuid references products (id) on delete set null, -- for auto-draft de-dup
  scheduled_at    timestamptz,
  published_at    timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger blog_posts_updated_at before update on blog_posts
  for each row execute function set_updated_at();

-- ── ops: fulfilment attempts + notifications ──────────────────────────────────
create table fulfilment_attempts (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders (id) on delete cascade,
  provider         pod_provider,
  status           fulfilment_attempt_status not null default 'pending',
  idempotency_key  text unique,                     -- retries never double-create
  provider_order_id text,
  error_detail     text,
  retry_count      integer not null default 0,
  attempted_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  type        notification_type not null,
  title       text not null,
  body        text,
  order_id    uuid references orders (id) on delete cascade,
  refund_id   uuid references refunds (id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ── indexes (§B-02 task 6: slugs, status, created_at, provider IDs) ───────────
create index products_status_idx        on products (status);
create index products_provider_idx      on products (provider, provider_product_id);
create index products_sort_idx          on products (sort_order);
create index variants_product_idx       on variants (product_id);
create index variants_provider_idx      on variants (provider_variant_id);
create index collection_products_product_idx on collection_products (product_id);
create index product_images_product_idx on product_images (product_id);
create index orders_created_at_idx      on orders (created_at);
create index orders_status_idx          on orders (status);
create index orders_email_idx           on orders (email);
create index orders_customer_idx        on orders (customer_id);
create index orders_pi_idx              on orders (stripe_payment_intent_id);
create index order_items_order_idx      on order_items (order_id);
create index order_items_sku_idx        on order_items (sku);
create index refunds_order_idx          on refunds (order_id);
create index refunds_status_idx         on refunds (status);
create index blog_posts_status_idx      on blog_posts (status);
create index blog_posts_product_idx     on blog_posts (product_id);
create index social_drafts_status_idx   on social_drafts (status);
create index fulfilment_attempts_order_idx on fulfilment_attempts (order_id);
create index notifications_unread_idx   on notifications (read_at) where read_at is null;

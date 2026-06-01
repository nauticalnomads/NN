-- Redesign v2 (Billabong) data architecture. Additive only — existing
-- products/orders/auth/collections tables are extended, never recreated.
-- `collections` and `collection_products` already exist from the init migration;
-- we ALTER collections to add the taxonomy columns. v2's `product_variants` maps
-- to our existing `variants` table.

-- ── collections: taxonomy columns (status already exists as product_status) ──
alter table collections
  add column if not exists gender text
    check (gender in ('men', 'women', 'unisex', 'accessories')),
  add column if not exists parent_slug text references collections (slug),
  add column if not exists hero_image_url text;

create index if not exists collections_gender_idx on collections (gender);
create index if not exists collections_parent_idx on collections (parent_slug);

-- ── products: gender + category + tags ───────────────────────────────────────
alter table products
  add column if not exists gender text check (gender in ('men', 'women', 'unisex')),
  add column if not exists category_slug text references collections (slug),
  add column if not exists tags text[] not null default '{}';

create index if not exists products_gender_idx on products (gender);
create index if not exists products_category_idx on products (category_slug);

-- ── CMS key/value content (homepage, mega-menu images, footer tags) ──────────
create table if not exists cms_content (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table cms_content enable row level security;
-- Public read (image URLs + marketing copy, non-sensitive); writes via service role.
drop policy if exists cms_content_public_read on cms_content;
create policy cms_content_public_read on cms_content for select using (true);

-- ── wishlists (per-user) ─────────────────────────────────────────────────────
create table if not exists wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  product_id uuid references products (id) on delete cascade,
  variant_id uuid references variants (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
alter table wishlists enable row level security;
drop policy if exists wishlists_self on wishlists;
create policy wishlists_self on wishlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── newsletter subscribers (service-role only) ───────────────────────────────
create table if not exists newsletter_subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  source        text not null default 'footer',
  discount_sent boolean not null default false,
  subscribed_at timestamptz not null default now()
);
alter table newsletter_subscribers enable row level security;
-- No anon/auth policies: only the service-role client (subscribe API + admin)
-- touches this table.

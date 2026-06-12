-- Product reviews / ratings (UGC).
--
-- One row per customer review of a product. Reviews are admin-moderated: they
-- land as `pending` and only show on the storefront once an admin sets them
-- `published`. `verified_purchase` is stamped at submit time when the reviewer
-- has a paid order containing the product.
--
-- RLS: the public (anon) may read ONLY published rows — that's the storefront
-- read path (lib/reviews → createPublicClient). All writes (customer submit,
-- admin moderation) go through the service role, which bypasses RLS, so there
-- are no insert/update policies.

create table if not exists product_reviews (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references products (id) on delete cascade,
  customer_id       uuid references customers (id) on delete set null,
  author_name       text not null,
  rating            int not null check (rating between 1 and 5),
  title             text,
  body              text not null,
  -- pending (awaiting moderation) | published | rejected
  status            text not null default 'pending',
  verified_purchase boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists product_reviews_product_idx on product_reviews (product_id, status);
create index if not exists product_reviews_status_idx on product_reviews (status);
-- One review per customer per product (guests/legacy rows with null customer_id
-- are exempt from the uniqueness constraint).
create unique index if not exists product_reviews_customer_product_idx
  on product_reviews (customer_id, product_id)
  where customer_id is not null;

create trigger product_reviews_updated_at before update on product_reviews
  for each row execute function set_updated_at();

alter table product_reviews enable row level security;

-- Public storefront read: published reviews only.
drop policy if exists product_reviews_public_read on product_reviews;
create policy product_reviews_public_read on product_reviews
  for select using (status = 'published');

notify pgrst, 'reload schema';

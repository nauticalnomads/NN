-- ─────────────────────────────────────────────────────────────────────────────
-- Nautical Nomads — 0002 RLS: helper functions + row level security
-- Enforces the permission matrix (master architecture §3) at the policy level.
-- App-layer guards (Session 08) back these up.
-- ─────────────────────────────────────────────────────────────────────────────

-- Role helpers. SECURITY DEFINER so they read public.users without recursing
-- through that table's own RLS policies. search_path locked for safety.
create or replace function current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.users where id = auth.uid() and is_active;
$$;

create or replace function is_master()
returns boolean language sql stable
set search_path = public, pg_temp
as $$ select current_user_role() = 'master'; $$;

-- Orders / refunds / financial / settings: master + regular only.
create or replace function is_ops()
returns boolean language sql stable
set search_path = public, pg_temp
as $$ select current_user_role() in ('master', 'regular'); $$;

-- Products / collections / blog / social: any of the three admin roles.
create or replace function is_staff()
returns boolean language sql stable
set search_path = public, pg_temp
as $$ select current_user_role() in ('master', 'regular', 'content'); $$;

-- ── enable RLS everywhere ─────────────────────────────────────────────────────
alter table users               enable row level security;
alter table customers           enable row level security;
alter table products            enable row level security;
alter table variants            enable row level security;
alter table collections         enable row level security;
alter table collection_products enable row level security;
alter table product_images      enable row level security;
alter table orders              enable row level security;
alter table order_items         enable row level security;
alter table refunds             enable row level security;
alter table store_settings      enable row level security;
alter table shipping_settings   enable row level security;
alter table social_drafts       enable row level security;
alter table blog_posts          enable row level security;
alter table fulfilment_attempts enable row level security;
alter table notifications       enable row level security;

-- ── users ─────────────────────────────────────────────────────────────────────
create policy users_select_self_or_master on users
  for select using (id = auth.uid() or is_master());
create policy users_master_write on users
  for all using (is_master()) with check (is_master());

-- ── customers ─────────────────────────────────────────────────────────────────
create policy customers_select_self_or_ops on customers
  for select using (user_id = auth.uid() or is_ops());
create policy customers_update_self on customers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy customers_ops_write on customers
  for all using (is_ops()) with check (is_ops());

-- ── catalogue: public reads PUBLISHED only; staff manage everything ───────────
create policy products_public_read on products
  for select using (status = 'published' or is_staff());
create policy products_staff_write on products
  for all using (is_staff()) with check (is_staff());

create policy variants_public_read on variants
  for select using (
    is_staff() or exists (
      select 1 from products p where p.id = variants.product_id and p.status = 'published'
    )
  );
create policy variants_staff_write on variants
  for all using (is_staff()) with check (is_staff());

create policy collections_public_read on collections
  for select using (status = 'published' or is_staff());
create policy collections_staff_write on collections
  for all using (is_staff()) with check (is_staff());

create policy collection_products_public_read on collection_products
  for select using (
    is_staff() or exists (
      select 1 from collections c
      where c.id = collection_products.collection_id and c.status = 'published'
    )
  );
create policy collection_products_staff_write on collection_products
  for all using (is_staff()) with check (is_staff());

create policy product_images_public_read on product_images
  for select using (
    is_staff() or exists (
      select 1 from products p where p.id = product_images.product_id and p.status = 'published'
    )
  );
create policy product_images_staff_write on product_images
  for all using (is_staff()) with check (is_staff());

-- ── orders: customer reads own; ops manage. Content admin has no access. ──────
create policy orders_select_own_or_ops on orders
  for select using (
    is_ops() or customer_id in (select id from customers where user_id = auth.uid())
  );
create policy orders_ops_write on orders
  for all using (is_ops()) with check (is_ops());

create policy order_items_select_own_or_ops on order_items
  for select using (
    is_ops() or exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.customer_id in (select id from customers where user_id = auth.uid())
    )
  );
create policy order_items_ops_write on order_items
  for all using (is_ops()) with check (is_ops());

-- ── refunds: customer reads own + can request on own order; ops manage ────────
create policy refunds_select_own_or_ops on refunds
  for select using (
    is_ops() or exists (
      select 1 from orders o
      where o.id = refunds.order_id
        and o.customer_id in (select id from customers where user_id = auth.uid())
    )
  );
create policy refunds_customer_request on refunds
  for insert with check (
    status = 'requested'
    and exists (
      select 1 from orders o
      where o.id = refunds.order_id
        and o.customer_id in (select id from customers where user_id = auth.uid())
    )
  );
create policy refunds_ops_write on refunds
  for all using (is_ops()) with check (is_ops());

-- ── settings: ops only (storefront/checkout read these server-side via service) ─
create policy store_settings_ops on store_settings
  for all using (is_ops()) with check (is_ops());
create policy shipping_settings_ops on shipping_settings
  for all using (is_ops()) with check (is_ops());

-- ── social drafts: any staff (incl. content admin) ───────────────────────────
create policy social_drafts_staff on social_drafts
  for all using (is_staff()) with check (is_staff());

-- ── blog: public reads published; staff manage ───────────────────────────────
create policy blog_public_read on blog_posts
  for select using (status = 'published' or is_staff());
create policy blog_staff_write on blog_posts
  for all using (is_staff()) with check (is_staff());

-- ── ops-only tables ───────────────────────────────────────────────────────────
create policy fulfilment_attempts_ops on fulfilment_attempts
  for all using (is_ops()) with check (is_ops());
create policy notifications_ops on notifications
  for all using (is_ops()) with check (is_ops());

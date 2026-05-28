-- ─────────────────────────────────────────────────────────────────────────────
-- Session 03 — source ids for idempotent re-runs of the Shopify migration,
-- plus the Supabase Storage bucket the migration uploads product images to.
-- ─────────────────────────────────────────────────────────────────────────────

alter table products add column if not exists source    text;
alter table products add column if not exists source_id text;
alter table variants add column if not exists source_id text;

create unique index if not exists products_source_id_uniq
  on products (source, source_id)
  where source_id is not null;

create unique index if not exists variants_source_id_uniq
  on variants (source_id)
  where source_id is not null;

-- Storage bucket for migrated product images (public read).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Anon read on this public bucket. Service role (used by the migration) bypasses
-- RLS, so no upload policy is needed.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'product_images_public_read'
  ) then
    create policy product_images_public_read on storage.objects
      for select using (bucket_id = 'product-images');
  end if;
end $$;

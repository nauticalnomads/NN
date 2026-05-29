-- ─────────────────────────────────────────────────────────────────────────────
-- Session 03c — DROP `jetprint` from pod_provider. Scope-reduction decision:
-- JetPrint products are no longer migrated. They've already been deleted from
-- products (which cascaded to variants, order_items, fulfilment_attempts,
-- product_images). Now we strip the enum value so the type matches the code.
--
-- PostgreSQL doesn't support `ALTER TYPE … DROP VALUE`, so we follow the
-- standard "rename + recreate + cast" dance.
--
-- Idempotent: short-circuits if `jetprint` is already absent.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from pg_enum
    where enumlabel = 'jetprint'
      and enumtypid = 'pod_provider'::regtype
  ) then
    -- Safety check: refuse to run if any rows still reference jetprint.
    if exists (select 1 from products            where provider = 'jetprint') or
       exists (select 1 from order_items         where provider = 'jetprint') or
       exists (select 1 from fulfilment_attempts where provider = 'jetprint') then
      raise exception 'rows with provider=jetprint still exist — delete them first';
    end if;

    alter type pod_provider rename to pod_provider__old;
    create type pod_provider as enum ('printful', 'printify');

    alter table products
      alter column provider type pod_provider
      using provider::text::pod_provider;

    alter table order_items
      alter column provider type pod_provider
      using provider::text::pod_provider;

    alter table fulfilment_attempts
      alter column provider type pod_provider
      using provider::text::pod_provider;

    drop type pod_provider__old;
  end if;
end $$;

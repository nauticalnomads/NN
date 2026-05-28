-- ─────────────────────────────────────────────────────────────────────────────
-- Session 03b — add `jetprint` to pod_provider; loosen variants/products to
-- allow extending provider list without a schema break. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'jetprint'
      and enumtypid = 'pod_provider'::regtype
  ) then
    alter type pod_provider add value 'jetprint';
  end if;
end $$;

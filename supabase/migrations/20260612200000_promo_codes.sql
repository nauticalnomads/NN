-- General promotions manager: percent-off discount codes created from the
-- admin (alongside the fixed STUDENT5 + newsletter welcome codes, which stay
-- code-defined). Read at checkout via the service role only — RLS is enabled
-- with no policies, so anon/authenticated clients can never enumerate codes.
create table if not exists promo_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  percent     numeric(5, 2) not null check (percent > 0 and percent <= 100),
  active      boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table promo_codes enable row level security;

notify pgrst, 'reload schema';

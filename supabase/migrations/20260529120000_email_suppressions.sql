-- Email suppression list for marketing-style emails (abandoned cart).
-- Transactional emails (receipts, shipping, refunds) are exempt and ignore this.
-- Keyed by lowercased email. Service-role only — never readable by anon.
create table if not exists email_suppressions (
  email       text primary key,
  reason      text,
  created_at  timestamptz not null default now()
);

alter table email_suppressions enable row level security;
-- No anon/auth policies: only the service-role client (cron + unsubscribe route)
-- touches this table, and it bypasses RLS. Keeps the list private.

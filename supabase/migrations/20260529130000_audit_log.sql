-- Audit log for sensitive admin actions — primarily the auto-fulfilment
-- kill-switch and dry-run toggle (§B-07 #9: "who/when toggled the switch").
-- Also captures other store-settings changes. Append-only in practice.
create table if not exists audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users (id) on delete set null,
  actor_email  text,
  action       text not null,          -- e.g. 'settings.auto_fulfilment_enabled'
  detail       jsonb not null default '{}'::jsonb,  -- { from, to }
  created_at   timestamptz not null default now()
);

create index if not exists audit_log_created_idx on audit_log (created_at desc);

alter table audit_log enable row level security;

-- Ops (master + regular) can read the audit log. Writes go through the
-- service-role client (server actions), which bypasses RLS.
create policy audit_log_ops_read on audit_log
  for select using (is_ops());

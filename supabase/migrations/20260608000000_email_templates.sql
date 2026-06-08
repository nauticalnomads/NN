-- Editable email templates (admin → Emails). Overrides for the code-default
-- subject/heading/body of each transactional email; reads fall back to the
-- defaults in lib/email-templates.ts when a row or field is absent.
create table if not exists email_templates (
  key text primary key,
  subject text,
  heading text,
  body text,
  updated_at timestamptz default now()
);

-- Server-only: all reads/writes go through the service-role client (admin UI +
-- email render). Enabling RLS with no policies denies anon/auth entirely.
alter table email_templates enable row level security;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Promote the owner to MASTER admin.
--
-- Run this ONCE, AFTER the owner has signed up through Supabase Auth (so a row
-- exists in auth.users). Replace the email below with the owner's email.
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.users (id, email, full_name, role, is_active)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', 'Owner'), 'master', true
from auth.users
where email = 'OWNER_EMAIL_HERE'
on conflict (id) do update
  set role = 'master', is_active = true, updated_at = now();

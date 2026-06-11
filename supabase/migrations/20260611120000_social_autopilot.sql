-- Social autopilot flag. When on, the hourly cron keeps a rolling queue of
-- scheduled posts topped up (lib/social → topUpSocialDrafts), auto-publishing at
-- 10:00 & 17:00 GMT. Lives on the single store_settings row (id = true).
alter table store_settings
  add column if not exists social_autopilot boolean not null default false;

notify pgrst, 'reload schema';

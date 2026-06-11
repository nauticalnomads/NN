-- Saved ordering of Drive photos for the social grid. The admin drags tiles into
-- an Instagram-style preview; the order here drives the sequence posts are
-- scheduled in (lib/social → rebuildQueueFromOrder / topUpSocialDrafts). Array of
-- Google Drive file ids on the single store_settings row (id = true).
alter table store_settings
  add column if not exists social_image_order text[] not null default '{}';

notify pgrst, 'reload schema';

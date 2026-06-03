-- Blog cover image (drafted from og:image, or uploaded/cropped in the editor).
alter table blog_posts add column if not exists cover_image_url text;

-- Refresh PostgREST's schema cache so the new column + the redesign tables
-- (cms_content, wishlists, newsletter_subscribers) are visible to the API.
notify pgrst, 'reload schema';

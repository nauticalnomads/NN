-- POD provider credentials, editable in /admin/settings (override the Worker
-- env-var fallback). Admin/service-role only; never exposed to the storefront.
alter table store_settings
  add column if not exists printful_api_key text,
  add column if not exists printful_store_id text,
  add column if not exists printful_webhook_secret text,
  add column if not exists printify_api_key text,
  add column if not exists printify_shop_id text,
  add column if not exists printify_webhook_secret text;

notify pgrst, 'reload schema';

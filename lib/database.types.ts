// Hand-maintained to mirror /supabase/migrations. Keep in sync when the schema
// changes (or regenerate with `supabase gen types typescript` once the CLI is
// wired to the project). Money columns are Postgres numeric → returned as number.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "master" | "regular" | "content";
export type ProductStatus = "draft" | "published";
export type PodProvider = "printful" | "printify";
export type OrderStatus =
  | "pending"
  | "paid"
  | "awaiting_fulfilment"
  | "fulfilling"
  | "shipped"
  | "delivered"
  | "fulfilment_failed"
  | "cancelled"
  | "refunded";
export type FulfilmentAttemptStatus = "pending" | "success" | "failed";
export type RefundStatus = "requested" | "processing" | "completed" | "failed" | "rejected";
export type ShippingMode = "live" | "flat";
export type SocialStatus = "draft" | "scheduled" | "posted" | "failed";
export type BlogStatus = "draft" | "scheduled" | "published" | "discarded";
export type BlogTrigger = "auto_new_product" | "auto_on_sale" | "manual_url";
export type NotificationType = "fulfilment_failed" | "refund_requested" | "dispute_opened";

type Timestamps = { created_at: string; updated_at: string };
// Row = full shape; Insert = required cols only (defaults optional); Update = all optional.
// Relationships kept empty — embedded selects are cast at the call site.
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface UserRow extends Timestamps {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface CustomerRow extends Timestamps {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
}

export interface ProductRow extends Timestamps {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  price: number;
  compare_at_price: number | null;
  currency: string;
  provider: PodProvider | null;
  provider_product_id: string | null;
  base_cost: number | null;
  seo_title: string | null;
  seo_description: string | null;
  sort_order: number;
  featured: boolean;
  published_at: string | null;
}

export interface VariantRow extends Timestamps {
  id: string;
  product_id: string;
  title: string | null;
  size: string | null;
  color: string | null;
  sku: string;
  provider_variant_id: string | null;
  price: number;
  base_cost: number | null;
  sort_order: number;
}

export interface CollectionRow extends Timestamps {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  seo_title: string | null;
  seo_description: string | null;
  sort_order: number;
}

export interface CollectionProductRow {
  collection_id: string;
  product_id: string;
  sort_order: number;
}

export interface ProductImageRow {
  id: string;
  product_id: string;
  url: string;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface OrderRow extends Timestamps {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  email: string;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  discount_total: number;
  grand_total: number;
  shipping_address: Json | null;
  billing_address: Json | null;
  shipping_quote: Json | null;
  shipping_mode: ShippingMode | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  provider_orders: Json;
  tracking: Json;
  placed_at: string | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  title: string;
  variant_title: string | null;
  sku: string;
  provider: PodProvider | null;
  provider_product_id: string | null;
  provider_variant_id: string | null;
  unit_price: number;
  base_cost: number | null;
  quantity: number;
  currency: string;
  created_at: string;
}

export interface RefundRow extends Timestamps {
  id: string;
  order_id: string;
  stripe_refund_id: string | null;
  amount: number;
  currency: string;
  reason: string | null;
  note: string | null;
  status: RefundStatus;
  requested_by: string | null;
  actioned_by: string | null;
}

export interface StoreSettingsRow {
  id: boolean;
  vat_enabled: boolean;
  vat_rate: number;
  currency: string;
  brand_voice: string | null;
  auto_fulfilment_enabled: boolean;
  fulfilment_dry_run: boolean;
  make_webhook_url: string | null;
  social_config: Json;
  notification_prefs: Json;
  updated_at: string;
}

export interface ShippingSettingsRow {
  id: boolean;
  mode: ShippingMode;
  flat_zones: Json;
  updated_at: string;
}

export interface SocialDraftRow extends Timestamps {
  id: string;
  image_ref: string | null;
  image_url: string | null;
  caption: string | null;
  status: SocialStatus;
  platform_targets: string[];
  scheduled_at: string | null;
  posted_at: string | null;
  created_by: string | null;
}

export interface BlogPostRow extends Timestamps {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  excerpt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: BlogStatus;
  trigger: BlogTrigger | null;
  source_url: string | null;
  product_id: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_by: string | null;
}

export interface FulfilmentAttemptRow {
  id: string;
  order_id: string;
  provider: PodProvider | null;
  status: FulfilmentAttemptStatus;
  idempotency_key: string | null;
  provider_order_id: string | null;
  error_detail: string | null;
  retry_count: number;
  attempted_at: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  order_id: string | null;
  refund_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface EmailSuppressionRow {
  email: string;
  reason: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      users: Table<UserRow, "id">;
      customers: Table<CustomerRow, "email">;
      products: Table<ProductRow, "title" | "slug">;
      variants: Table<VariantRow, "product_id" | "sku">;
      collections: Table<CollectionRow, "title" | "slug">;
      collection_products: Table<CollectionProductRow, "collection_id" | "product_id">;
      product_images: Table<ProductImageRow, "product_id" | "url">;
      orders: Table<OrderRow, "email">;
      order_items: Table<OrderItemRow, "order_id" | "title" | "sku" | "unit_price" | "quantity">;
      refunds: Table<RefundRow, "order_id" | "amount">;
      store_settings: Table<StoreSettingsRow, "id">;
      shipping_settings: Table<ShippingSettingsRow, "id">;
      social_drafts: Table<SocialDraftRow, "id">;
      blog_posts: Table<BlogPostRow, "title" | "slug">;
      fulfilment_attempts: Table<FulfilmentAttemptRow, "order_id">;
      notifications: Table<NotificationRow, "type" | "title">;
      email_suppressions: Table<EmailSuppressionRow, "email">;
    };
    Views: Record<never, never>;
    Functions: {
      current_user_role: { Args: Record<never, never>; Returns: UserRole | null };
      is_master: { Args: Record<never, never>; Returns: boolean };
      is_ops: { Args: Record<never, never>; Returns: boolean };
      is_staff: { Args: Record<never, never>; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      product_status: ProductStatus;
      pod_provider: PodProvider;
      order_status: OrderStatus;
      fulfilment_attempt_status: FulfilmentAttemptStatus;
      refund_status: RefundStatus;
      shipping_mode: ShippingMode;
      social_status: SocialStatus;
      blog_status: BlogStatus;
      blog_trigger: BlogTrigger;
      notification_type: NotificationType;
    };
  };
}

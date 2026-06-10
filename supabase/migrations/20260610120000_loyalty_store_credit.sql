-- Account-based loyalty: store credit ledger + referrals.
--
-- store_credit_transactions — append-only signed ledger, one row per movement:
--   + earns/grants (loyalty_earn, referral_referrer, referral_referee,
--     admin_grant) and − redemptions (redemption). A customer's available
--     balance is the sum of `applied` rows; redemptions are reserved as
--     `pending` at checkout and flipped to `applied` (or `void`) on payment —
--     the same reserve→apply discipline as gift cards.
--
-- Like gift cards, balances are sensitive, so RLS is on with NO policies:
-- only the service role touches this table, via lib/store-credit.ts. The
-- account page reads a customer's own ledger server-side (already scoped to
-- their authenticated customer id).
--
-- customers gains a referral_code (each account's shareable code) and
-- referred_by (who referred them, set once at sign-up).

alter table customers
  add column if not exists referral_code text unique,
  add column if not exists referred_by  uuid references customers (id) on delete set null;

create table if not exists store_credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  -- signed: positive = credit earned/granted, negative = credit redeemed.
  amount      numeric(12, 2) not null check (amount <> 0),
  currency    text not null default 'GBP',
  -- loyalty_earn | referral_referrer | referral_referee | admin_grant |
  -- redemption | reversal
  reason      text not null,
  -- applied (counts toward balance) | pending (reserved redemption) | void
  status      text not null default 'applied',
  order_id    uuid references orders (id) on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  applied_at  timestamptz
);
create index if not exists sct_customer_idx on store_credit_transactions (customer_id);
create index if not exists sct_order_idx on store_credit_transactions (order_id);
-- Idempotency for order-driven movements: at most one row per (order, reason),
-- so re-running the post-payment hook can't double-grant or double-redeem.
create unique index if not exists sct_order_reason_uq
  on store_credit_transactions (order_id, reason)
  where order_id is not null;

alter table store_credit_transactions enable row level security;
-- Intentionally no policies — service-role only.

notify pgrst, 'reload schema';

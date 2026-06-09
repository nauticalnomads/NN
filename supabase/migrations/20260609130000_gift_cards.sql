-- Purchasable, redeemable digital gift cards (1-year expiry).
--
-- gift_cards          — one row per issued card: code, balance, status, expiry.
-- gift_card_redemptions — append-only log of balance applied to orders.
--
-- Both tables hold sensitive data (codes, balances), so RLS is enabled with NO
-- policies: only the service role (which bypasses RLS) may read or write them.
-- All access goes through server code in lib/gift-cards.ts.

create table if not exists gift_cards (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  initial_amount   numeric(12, 2) not null check (initial_amount > 0),
  balance          numeric(12, 2) not null check (balance >= 0),
  currency         text not null default 'GBP',
  -- pending (bought, awaiting payment) | active | redeemed (balance 0) |
  -- expired | void
  status           text not null default 'pending',
  purchaser_email  text,
  order_id         uuid references orders (id) on delete set null,
  activated_at     timestamptz,
  expires_at       timestamptz,
  last_redeemed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists gift_cards_code_idx on gift_cards (code);
create index if not exists gift_cards_order_idx on gift_cards (order_id);

create trigger gift_cards_updated_at before update on gift_cards
  for each row execute function set_updated_at();

create table if not exists gift_card_redemptions (
  id           uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references gift_cards (id) on delete cascade,
  order_id     uuid references orders (id) on delete set null,
  amount       numeric(12, 2) not null check (amount > 0),
  currency     text not null default 'GBP',
  -- pending (reserved at checkout) | applied (debited on payment) | void
  status       text not null default 'pending',
  applied_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists gcr_card_idx on gift_card_redemptions (gift_card_id);
create index if not exists gcr_order_idx on gift_card_redemptions (order_id);

alter table gift_cards enable row level security;
alter table gift_card_redemptions enable row level security;
-- Intentionally no policies — service-role only.

notify pgrst, 'reload schema';

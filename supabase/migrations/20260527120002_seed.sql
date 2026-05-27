-- ─────────────────────────────────────────────────────────────────────────────
-- Nautical Nomads — 0003 seed: singleton settings (idempotent)
-- VAT OFF, live shipping, auto-fulfilment ON, brand voice + examples (§8/§9.3).
-- ─────────────────────────────────────────────────────────────────────────────

insert into store_settings (id, vat_enabled, vat_rate, currency, auto_fulfilment_enabled, fulfilment_dry_run, brand_voice)
values (
  true, false, 0, 'GBP', true, true,
$voice$NAUTICAL NOMADS — BRAND VOICE

Plainspoken, sun-warmed, loose and lived-in. Curious, earned, true. We dress people who chase
weather, not weekends. Tagline: "Live by the tide."

DO
- Open with a small specific image (fog, salt, a screen door, a cold morning).
- Short sentences. Trust the reader.
- Name materials and places (Lisbon, long-staple cotton, mesh-lined, garment-dyed).
- Lowercase-friendly, observational, occasional small emoji.

DON'T
- No surf-bro slang (gnarly, stoked, shred).
- No exclamation marks.
- No empty marketing words (premium, curated, elevated, must-have).
- No moralising about the ocean.

QUICK CHECK
"If you wouldn't say it to a friend over coffee at the harbor — rewrite it."

EXAMPLE CAPTIONS (match this tone — short, minimal, emoji optional)
- "Tuesday, 6:14 am. Coffee was bad. Water was fine."
- "salt still in my hair. worth it 🌊"
- "the fog burned off around ten. we stayed anyway."
- "long-staple cotton. soft the first day, softer the hundredth."
- "screen door, slow morning, nowhere to be."
- "packed light. wore the same tee three days. no regrets."

EXAMPLE PRODUCT DESCRIPTIONS (brand voice, honest, material-led)
- "The everyday tee. Long-staple cotton, garment-dyed so the colour settles in instead of sitting
  on top. Mid-weight — holds its shape on the line, breaks in by the second wash. Cut a little
  relaxed through the body. Wear it to the water and back."
- "A hoodie for cold mornings on the dock. Brushed inside, mesh-lined hood, a kangaroo pocket deep
  enough for cold hands and a set of keys. Heavy enough to mean it, soft enough to live in."
- "The crew sweat. Loop-back cotton, ribbed cuffs that stay put, a collar that won't stretch out.
  Made in Lisbon. The kind of thing you reach for without thinking."
$voice$
)
on conflict (id) do update set
  brand_voice = excluded.brand_voice,
  updated_at = now();

insert into shipping_settings (id, mode, flat_zones)
values (
  true, 'live',
  $zones$[
    {"name": "UK", "countries": ["GB"], "rate": 3.95},
    {"name": "Europe", "countries": ["IE","FR","DE","ES","IT","NL","BE","PT","SE","DK","PL","AT"], "rate": 7.95},
    {"name": "Rest of World", "countries": ["*"], "rate": 12.95}
  ]$zones$::jsonb
)
on conflict (id) do nothing;

// Minimal shipping cost helper. Session 06 replaces this with live POD quotes
// from Printful/Printify; this implementation reads the flat-zones from
// shipping_settings and falls back to a sensible RoW rate.
import { createServiceClient } from "@/lib/supabase/service";

export type ShippingAddress = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  postal_code?: string;
  country: string; // ISO-2
};

type Zone = { name: string; countries: string[]; rate: number };

export async function quoteShipping(addr: ShippingAddress, itemCount: number) {
  void itemCount; // reserved for live-quote weight calcs in Session 06
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("shipping_settings")
      .select("flat_zones, mode")
      .eq("id", true)
      .maybeSingle();
    const row = data as unknown as { flat_zones: Zone[]; mode: string } | null;
    const zones = row?.flat_zones ?? [];
    const country = (addr.country || "").toUpperCase();

    const specific = zones.find((z) => z.countries.includes(country));
    if (specific) return { rate: Number(specific.rate) || 0, zone: specific.name, mode: "flat" };

    const fallback = zones.find((z) => z.countries.includes("*"));
    if (fallback) return { rate: Number(fallback.rate) || 0, zone: fallback.name, mode: "flat" };

    return { rate: 12.95, zone: "Rest of World (default)", mode: "flat" };
  } catch {
    return { rate: 12.95, zone: "Rest of World (default)", mode: "flat" };
  }
}

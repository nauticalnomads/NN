import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateSettings } from "./actions";
import { ZoneEditor, type Zone } from "./ZoneEditor";

export default async function AdminSettings() {
  await requireOps();
  const sb = await createClient();
  const { data: store } = await sb.from("store_settings").select("*").eq("id", true).maybeSingle();
  const { data: ship } = await sb
    .from("shipping_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const s = (store as unknown as Record<string, unknown>) || {};
  const sh = (ship as unknown as Record<string, unknown>) || {};
  const zones: Zone[] = Array.isArray(sh.flat_zones) ? (sh.flat_zones as Zone[]) : [];

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-display-2 tracking-tight text-ink">Settings</h1>
      <form action={updateSettings} className="mt-8 space-y-8">
        <Toggle
          label="Auto-fulfilment enabled"
          name="auto_fulfilment_enabled"
          defaultChecked={!!s.auto_fulfilment_enabled}
          help="Kill-switch. Off ⇒ paid orders queue as awaiting_fulfilment."
        />
        <Toggle
          label="Fulfilment dry-run"
          name="fulfilment_dry_run"
          defaultChecked={!!s.fulfilment_dry_run}
          help="ON in non-production. Prevents real POD orders being placed."
        />
        <Toggle
          label="VAT enabled"
          name="vat_enabled"
          defaultChecked={!!s.vat_enabled}
          help="Keep OFF until VAT-registered. Charging VAT while unregistered is not permitted."
        />
        <NumberField
          label="VAT rate (%)"
          name="vat_rate"
          defaultValue={Number(s.vat_rate ?? 0)}
          step="0.01"
        />
        <Select
          label="Shipping mode"
          name="shipping_mode"
          defaultValue={(sh.mode as string) || "live"}
          options={[
            { v: "live", l: "Live POD quotes (with flat fallback on failure)" },
            { v: "flat", l: "Flat zone rates" },
          ]}
        />
        <div>
          <p className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Flat shipping zones
          </p>
          <p className="mt-1 mb-3 font-mono text-caption text-ink/50">
            Used when shipping mode is &quot;flat&quot;, and as the fallback when live POD quotes
            fail in &quot;live&quot; mode.
          </p>
          <ZoneEditor initial={zones} />
        </div>
        <TextField
          label="Make.com webhook URL (for social tool publishing)"
          name="make_webhook_url"
          defaultValue={(s.make_webhook_url as string) || ""}
          placeholder="https://hook.make.com/…"
        />
        <Textarea
          label="Brand voice (used by AI for captions & blog drafts)"
          name="brand_voice"
          defaultValue={(s.brand_voice as string) || ""}
          rows={14}
        />
        <button className="rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase">
          Save
        </button>
      </form>
    </div>
  );
}

function Toggle({
  label,
  name,
  defaultChecked,
  help,
}: {
  label: string;
  name: string;
  defaultChecked: boolean;
  help: string;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1.5 h-4 w-4 accent-accent-sun"
      />
      <span>
        <span className="block font-body text-body text-ink">{label}</span>
        <span className="block font-mono text-caption text-ink/50">{help}</span>
      </span>
    </label>
  );
}
function TextField({
  label,
  name,
  defaultValue,
  placeholder = "",
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption text-ink"
      />
    </label>
  );
}
function NumberField({
  label,
  name,
  defaultValue,
  step = "1",
}: {
  label: string;
  name: string;
  defaultValue: number;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</span>
      <input
        type="number"
        step={step}
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-32 rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
      />
    </label>
  );
}
function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}
function Textarea({
  label,
  name,
  defaultValue,
  rows = 6,
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption text-ink"
      />
    </label>
  );
}

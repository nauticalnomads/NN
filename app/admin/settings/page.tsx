import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateSettings, saveIntegrations } from "./actions";
import { ZoneEditor, type Zone } from "./ZoneEditor";
import { getIntegrationConfig, getGoogleConfig } from "@/lib/integrations";
import { absoluteUrl } from "@/lib/site";
import { SubmitButton } from "@/components/admin/SubmitButton";

export default async function AdminSettings({
  searchParams,
}: {
  searchParams: Promise<{ integrations?: string }>;
}) {
  await requireOps();
  const { integrations: integStatus } = await searchParams;
  const [integ, google] = await Promise.all([getIntegrationConfig(), getGoogleConfig()]);
  const pfWebhook = absoluteUrl(
    `/api/webhooks/printful?token=${integ.printful.webhookSecret || "YOUR_SECRET"}`,
  );
  const piWebhook = absoluteUrl(
    `/api/webhooks/printify?token=${integ.printify.webhookSecret || "YOUR_SECRET"}`,
  );
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
  const prefs = (s.notification_prefs as Record<string, boolean> | null) || {};

  // Recent settings-change audit trail (empty/absent if not yet migrated).
  let audit: Array<{
    id: string;
    actor_email: string | null;
    action: string;
    detail: { from?: unknown; to?: unknown };
    created_at: string;
  }> = [];
  try {
    const { data } = await sb
      .from("audit_log")
      .select("id, actor_email, action, detail, created_at")
      .like("action", "settings.%")
      .order("created_at", { ascending: false })
      .limit(15);
    audit = (data as unknown as typeof audit) || [];
  } catch {
    audit = [];
  }

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
        <div>
          <p className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Owner email alerts
          </p>
          <p className="mt-1 mb-3 font-mono text-caption text-ink/50">
            Email the owner only on attention-needed events. Routine orders stay in the admin, never
            the inbox. All events still appear in the Notifications inbox regardless of these
            toggles.
          </p>
          <div className="space-y-4">
            <Toggle
              label="Fulfilment failed"
              name="notify_fulfilment_failed"
              defaultChecked={prefs.fulfilment_failed !== false}
              help="A paid order could not be placed with the POD provider."
            />
            <Toggle
              label="Refund requested"
              name="notify_refund_requested"
              defaultChecked={prefs.refund_requested !== false}
              help="A customer requested a refund on their order."
            />
            <Toggle
              label="Dispute opened"
              name="notify_dispute_opened"
              defaultChecked={prefs.dispute_opened !== false}
              help="A Stripe payment dispute / chargeback was opened."
            />
          </div>
        </div>
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

      {/* ── Social automation ────────────────────────────────────────────── */}
      <section className="mt-14 border-t border-ink/10 pt-10">
        <h2 className="font-display text-heading text-ink">Social automation</h2>
        <p className="mt-1 font-mono text-caption text-ink/50">
          Powers the Social tab: Drive photos → AI caption → schedule → publish via Make.com.
        </p>

        {/* Status panel */}
        <div className="mt-5 rounded-sm border border-ink/10 bg-surface-2/40 p-4 space-y-2">
          <p className="font-mono text-caption tracking-wide text-ink/60 uppercase mb-3">
            Setup status
          </p>
          <StatusRow
            label="Google service account"
            ok={!!google.serviceAccountJson}
            okText="Connected — Drive photos will load"
            failText="Not set — paste your service account JSON below"
          />
          <StatusRow
            label="Google Drive folder"
            ok={!!google.driveFolderId}
            okText={`Folder ID set`}
            failText="Not set — paste your folder ID below"
          />
          <StatusRow
            label="Make.com webhook"
            ok={!!(s.make_webhook_url as string)}
            okText="Webhook configured — posts will publish"
            failText="Not set — paste your Make.com webhook URL below"
          />
        </div>

        {/* Step-by-step instructions */}
        <div className="mt-5 rounded-sm border border-accent-sun/30 bg-accent-sun/5 p-4 space-y-3 font-mono text-caption text-ink/70">
          <p className="font-mono text-caption tracking-wide text-ink uppercase">
            How to connect (3 steps)
          </p>
          <div>
            <p className="text-ink font-semibold">Step 1 — Google service account</p>
            <p className="mt-1">
              Go to <span className="text-ink">console.cloud.google.com</span> → IAM &amp; Admin →
              Service Accounts → Create. Give it any name. Click the account → Keys → Add Key →
              JSON. Download the file and paste the entire contents into the field below.
              <br />
              Then open <span className="text-ink">drive.google.com</span>, right-click your photos
              folder → Share, and share it with the service account&apos;s{" "}
              <span className="text-ink">client_email</span> address (found inside the JSON).
            </p>
          </div>
          <div>
            <p className="text-ink font-semibold">Step 2 — Drive folder ID</p>
            <p className="mt-1">
              Open the folder in Drive. Copy the long ID from the URL:{" "}
              <span className="text-ink">
                drive.google.com/drive/folders/<strong>THIS_PART</strong>
              </span>
              . Paste it into the field below.
            </p>
          </div>
          <div>
            <p className="text-ink font-semibold">Step 3 — Make.com webhook</p>
            <p className="mt-1">
              In Make.com, create a scenario with a{" "}
              <span className="text-ink">Webhooks → Custom webhook</span> trigger. Copy the webhook
              URL (starts with <span className="text-ink">https://hook.eu2.make.com/…</span> or
              similar). Paste it below. Wire the scenario to post{" "}
              <span className="text-ink">image_url</span>, <span className="text-ink">caption</span>
              , and <span className="text-ink">platforms</span> to Instagram/Facebook.
            </p>
          </div>
        </div>

        <form action={saveIntegrations} className="mt-5 space-y-4">
          <input type="hidden" name="__section" value="social" />
          <SecretTextarea
            label="Google Service Account JSON"
            name="google_service_account_json"
            set={!!google.serviceAccountJson}
            placeholder={`Paste the entire contents of your downloaded service-account key JSON file:\n{\n  "type": "service_account",\n  "project_id": "...",\n  "client_email": "...@....iam.gserviceaccount.com",\n  ...\n}`}
            rows={8}
          />
          <TextField
            label="Google Drive Folder ID"
            name="google_drive_folder_id"
            defaultValue={google.driveFolderId}
            placeholder="e.g. 1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
          />
          <TextField
            label="Email Covers — Google Drive Folder ID"
            name="email_covers_folder_id"
            defaultValue={google.emailCoversFolderId}
            placeholder="e.g. 1J-TRvxR4u494jUMCBB5DaZYHEOMqcEKd"
          />
          <p className="font-mono text-caption text-ink/50">
            Images in this Drive folder will rotate as email header banners. Share the folder with{" "}
            <span className="text-ink">
              {google.serviceAccountJson
                ? (() => {
                    try {
                      return JSON.parse(google.serviceAccountJson).client_email;
                    } catch {
                      return "your service account email";
                    }
                  })()
                : "your service account email"}
            </span>
            .
          </p>
          <TextField
            label="Make.com Webhook URL"
            name="make_webhook_url"
            defaultValue={(s.make_webhook_url as string) || ""}
            placeholder="https://hook.eu2.make.com/…"
          />
          <SubmitButton className="rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase">
            Save social config
          </SubmitButton>
        </form>

        <details className="mt-4 font-mono text-caption text-ink/50">
          <summary className="cursor-pointer">
            One-time SQL (run in Supabase if saving fails)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-sm bg-ink/5 p-3 text-[11px] text-ink/70">{`alter table store_settings
  add column if not exists google_service_account_json text,
  add column if not exists google_drive_folder_id text;
notify pgrst, 'reload schema';`}</pre>
        </details>
      </section>

      {/* ── POD integrations ─────────────────────────────────────────────── */}
      <section className="mt-14 border-t border-ink/10 pt-10">
        <h2 className="font-display text-heading text-ink">POD integrations</h2>
        <p className="mt-1 font-mono text-caption text-ink/50">
          Printful &amp; Printify credentials. Values saved here override the Cloudflare secrets.
          Secret fields are write-only — leave blank to keep the current value.
        </p>

        {integStatus === "saved" && (
          <div className="mt-4 rounded-sm border border-accent-sea/30 bg-accent-sea/5 px-4 py-3 font-body text-caption text-ink">
            Integration settings saved.
          </div>
        )}
        {integStatus === "migrate" && (
          <div className="mt-4 rounded-sm border border-accent-sun/40 bg-accent-sun/5 px-4 py-3 font-body text-caption text-ink">
            Couldn&apos;t save — run the one-time SQL at the bottom of this section first, then try
            again.
          </div>
        )}

        <div className="mt-4 space-y-1 rounded-sm border border-ink/10 bg-surface-2/40 p-4 font-mono text-caption text-ink/70">
          <div>
            Printful — API key {integ.printful.apiKey ? "✓" : "✗"} · Store ID{" "}
            <span className="text-ink">{integ.printful.storeId || "✗"}</span> · Webhook{" "}
            {integ.printful.webhookSecret ? "✓" : "✗"}
          </div>
          <div>
            Printify — API key {integ.printify.apiKey ? "✓" : "✗"} · Shop ID{" "}
            <span className="text-ink">{integ.printify.shopId || "✗"}</span> · Webhook{" "}
            {integ.printify.webhookSecret ? "✓" : "✗"}
          </div>
          <div className="pt-2 text-ink/50">Webhook URLs to paste into the provider dashboard:</div>
          <div className="break-all text-ink">Printful → {pfWebhook}</div>
          <div className="break-all text-ink">Printify → {piWebhook}</div>
        </div>

        <form action={saveIntegrations} className="mt-5 space-y-4">
          <p className="font-mono text-caption tracking-wide text-accent-sun uppercase">Printful</p>
          <SecretField
            label="Printful API key"
            name="printful_api_key"
            set={!!integ.printful.apiKey}
          />
          <TextField
            label="Printful Store ID"
            name="printful_store_id"
            defaultValue={integ.printful.storeId}
            placeholder="e.g. 17467626"
          />
          <SecretField
            label="Printful webhook secret"
            name="printful_webhook_secret"
            set={!!integ.printful.webhookSecret}
          />
          <p className="pt-2 font-mono text-caption tracking-wide text-accent-sun uppercase">
            Printify
          </p>
          <SecretField
            label="Printify API key"
            name="printify_api_key"
            set={!!integ.printify.apiKey}
          />
          <TextField
            label="Printify Shop ID"
            name="printify_shop_id"
            defaultValue={integ.printify.shopId}
            placeholder="e.g. 18245866"
          />
          <SecretField
            label="Printify webhook secret"
            name="printify_webhook_secret"
            set={!!integ.printify.webhookSecret}
          />
          <SubmitButton className="rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase">
            Save integrations
          </SubmitButton>
        </form>

        <details className="mt-4 font-mono text-caption text-ink/50">
          <summary className="cursor-pointer">
            One-time SQL (run in Supabase if saving fails)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-sm bg-ink/5 p-3 text-[11px] text-ink/70">{`alter table store_settings
  add column if not exists printful_api_key text,
  add column if not exists printful_store_id text,
  add column if not exists printful_webhook_secret text,
  add column if not exists printify_api_key text,
  add column if not exists printify_shop_id text,
  add column if not exists printify_webhook_secret text;
notify pgrst, 'reload schema';`}</pre>
        </details>
      </section>

      {audit.length > 0 && (
        <div className="mt-14">
          <p className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Recent settings changes
          </p>
          <ul className="mt-3 space-y-2">
            {audit.map((a) => (
              <li key={a.id} className="font-mono text-caption text-ink/70">
                <span className="text-ink/40">
                  {new Date(a.created_at).toLocaleString("en-GB")}
                </span>{" "}
                · {a.actor_email ?? "—"} set{" "}
                <span className="text-ink">{a.action.replace("settings.", "")}</span> from{" "}
                <span className="text-ink">{String(a.detail?.from)}</span> →{" "}
                <span className="text-accent-sun">{String(a.detail?.to)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
function SecretField({ label, name, set }: { label: string; name: string; set: boolean }) {
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</span>
      <input
        type="password"
        name={name}
        autoComplete="off"
        placeholder={set ? "•••••••• (set — blank keeps it)" : "not set"}
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
function StatusRow({
  label,
  ok,
  okText,
  failText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  failText: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase ${ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}
      >
        {ok ? "✓ set" : "✗ missing"}
      </span>
      <span>
        <span className="font-mono text-caption text-ink">{label}</span>
        <span className="block font-mono text-caption text-ink/50">{ok ? okText : failText}</span>
      </span>
    </div>
  );
}
function SecretTextarea({
  label,
  name,
  set,
  placeholder,
  rows = 6,
}: {
  label: string;
  name: string;
  set: boolean;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">{label}</span>
      {set && (
        <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 font-mono text-[10px] tracking-widest text-green-800 uppercase">
          ✓ set — blank keeps current
        </span>
      )}
      <textarea
        name={name}
        autoComplete="off"
        placeholder={
          set ? "Leave blank to keep the current value. Paste new JSON to replace it." : placeholder
        }
        rows={rows}
        className="mt-2 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-[11px] text-ink placeholder:text-ink/30"
      />
    </label>
  );
}

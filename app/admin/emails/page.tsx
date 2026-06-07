import { requireOps } from "@/lib/auth";
import { getAdminTemplates, type AdminTemplate } from "@/lib/email-templates";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveTemplate, resetTemplate, sendTest } from "./actions";

export default async function AdminEmails({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireOps();
  const { status } = await searchParams;
  const templates = await getAdminTemplates();

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-display-2 tracking-tight text-ink">Emails</h1>
      <p className="mt-2 max-w-xl font-body text-body text-ink/60">
        Edit the subject, heading and HTML body of every email the shop sends. Use{" "}
        <code className="font-mono text-caption text-accent-sun">{"{{variable}}"}</code>{" "}
        placeholders for the dynamic bits — they&apos;re listed under each template. Leave a field
        blank to use the built-in default.
      </p>

      <StatusBanner status={status} />

      <div className="mt-8 space-y-12">
        {templates.map((t) => (
          <TemplateCard key={t.def.key} t={t} />
        ))}
      </div>

      <details className="mt-14 font-mono text-caption text-ink/50">
        <summary className="cursor-pointer">One-time SQL (run in Supabase if saving fails)</summary>
        <pre className="mt-2 overflow-x-auto rounded-sm bg-ink/5 p-3 text-[11px] text-ink/70">{`create table if not exists email_templates (
  key text primary key,
  subject text,
  heading text,
  body text,
  updated_at timestamptz default now()
);
alter table email_templates enable row level security;
notify pgrst, 'reload schema';`}</pre>
      </details>
    </div>
  );
}

function StatusBanner({ status }: { status?: string }) {
  if (!status) return null;
  const map: Record<string, { ok: boolean; msg: string }> = {
    saved: { ok: true, msg: "Template saved." },
    reset: { ok: true, msg: "Template reverted to the built-in default." },
    sent: { ok: true, msg: "Test email sent to your address." },
    noemail: { ok: false, msg: "Rendered fine, but Resend isn't configured so nothing was sent." },
    migrate: {
      ok: false,
      msg: "Couldn't save — run the one-time SQL at the bottom of this page first, then try again.",
    },
    error: { ok: false, msg: "Something went wrong. Try again." },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <div
      className={`mt-4 rounded-sm border px-4 py-3 font-body text-caption text-ink ${
        s.ok ? "border-accent-sea/30 bg-accent-sea/5" : "border-accent-sun/40 bg-accent-sun/5"
      }`}
    >
      {s.msg}
    </div>
  );
}

function TemplateCard({ t }: { t: AdminTemplate }) {
  const { def } = t;
  const hasSubject = def.defaultSubject !== undefined;
  const hasHeading = def.defaultHeading !== undefined;
  return (
    <section id={def.key} className="scroll-mt-6 border-t border-ink/10 pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-heading text-ink">{def.label}</h2>
        <div className="flex items-center gap-2 font-mono text-caption">
          {def.internal && <span className="text-ink/40 uppercase">internal</span>}
          <span className={t.overridden ? "text-accent-sun uppercase" : "text-ink/40 uppercase"}>
            {t.overridden ? "customised" : "default"}
          </span>
        </div>
      </div>
      <p className="mt-1 font-mono text-caption text-ink/50">{def.description}</p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <form action={saveTemplate} className="space-y-4">
          <input type="hidden" name="key" value={def.key} />
          {hasSubject && (
            <Labeled label="Subject">
              <input
                type="text"
                name="subject"
                defaultValue={t.subject}
                className="block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption text-ink"
              />
            </Labeled>
          )}
          {hasHeading && (
            <Labeled label="Heading">
              <input
                type="text"
                name="heading"
                defaultValue={t.heading}
                className="block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption text-ink"
              />
            </Labeled>
          )}
          <Labeled label={def.key === "layout" ? "Layout HTML" : "Body (HTML)"}>
            <textarea
              name="body"
              defaultValue={t.body}
              rows={def.key === "layout" ? 18 : 12}
              spellCheck={false}
              className="block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-[11px] leading-relaxed text-ink"
            />
          </Labeled>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton className="rounded-sm bg-accent-sun px-5 py-2.5 font-mono text-xs tracking-widest text-surface uppercase">
              Save
            </SubmitButton>
          </div>
        </form>

        <div className="space-y-4">
          <div>
            <p className="font-mono text-caption tracking-wide text-ink/60 uppercase">Variables</p>
            <ul className="mt-2 space-y-1.5">
              {def.vars.map((v) => (
                <li key={v.name} className="font-mono text-[11px] text-ink/60">
                  <code className="text-accent-sun">{`{{${v.name}}}`}</code>
                  <span className="text-ink/50"> — {v.description}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={resetTemplate}>
              <input type="hidden" name="key" value={def.key} />
              <SubmitButton className="rounded-sm border border-ink/20 px-3 py-2 font-mono text-[11px] tracking-wide text-ink/70 uppercase">
                Reset to default
              </SubmitButton>
            </form>
            <form action={sendTest}>
              <input type="hidden" name="key" value={def.key} />
              <SubmitButton className="rounded-sm border border-ink/20 px-3 py-2 font-mono text-[11px] tracking-wide text-ink/70 uppercase">
                Send test to me
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <p className="font-mono text-caption tracking-wide text-ink/60 uppercase">Preview</p>
        <iframe
          title={`${def.label} preview`}
          srcDoc={t.preview}
          sandbox=""
          className="mt-2 h-80 w-full rounded-sm border border-ink/10 bg-white"
        />
      </div>
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-caption tracking-wide text-ink/60 uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

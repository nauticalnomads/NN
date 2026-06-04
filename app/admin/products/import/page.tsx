import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { printfulConfigured } from "@/lib/printful";
import { importFromPrintful } from "../actions";
import { SubmitButton } from "@/components/admin/SubmitButton";

export default async function PrintfulImport({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; skipped?: string; variants?: string; error?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const configured = printfulConfigured();

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/products"
        className="font-mono text-caption text-ink/50 no-underline hover:text-accent-sun"
      >
        ← Products
      </Link>
      <h1 className="mt-2 font-display text-display-2 tracking-tight text-ink">
        Import from Printful
      </h1>
      <p className="mt-3 font-body text-body text-ink/60">
        Pulls products from your Printful store and creates them here as <strong>drafts</strong>{" "}
        (mapped to Printful for fulfilment). Already-imported products are skipped. After importing,
        set the category &amp; price, then publish.
      </p>

      {!configured && (
        <div className="mt-6 rounded-sm border border-accent-sun/40 bg-accent-sun/5 px-4 py-3 font-body text-caption text-ink">
          <strong>PRINTFUL_API_KEY is not set.</strong> Add it (and <code>PRINTFUL_STORE_ID</code>{" "}
          if your token covers multiple stores) as a secret on the Cloudflare Worker, then reload
          this page.
        </div>
      )}

      {sp.error && (
        <div className="mt-6 rounded-sm border border-red-400/50 bg-red-50 px-4 py-3 font-body text-caption text-ink">
          {sp.error === "nokey" ? "PRINTFUL_API_KEY is not set." : `Import error: ${sp.error}`}
        </div>
      )}
      {sp.created != null && (
        <div className="mt-6 rounded-sm border border-accent-sea/30 bg-accent-sea/5 px-4 py-3 font-body text-caption text-ink">
          Imported <strong>{sp.created}</strong> product(s) with <strong>{sp.variants ?? 0}</strong>{" "}
          variant(s); skipped {sp.skipped ?? 0} already-mapped.{" "}
          <Link href="/admin/products?category=__none__" className="text-accent-sun underline">
            Review &amp; categorise →
          </Link>
        </div>
      )}

      <form action={importFromPrintful} className="mt-8 space-y-4">
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            Printful sync product ID (optional)
          </span>
          <input
            name="sync_id"
            placeholder="Leave blank to import all new products"
            className="mt-1.5 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
          />
          <span className="mt-1 block font-body text-[11px] text-ink/40">
            Find it in Printful → Stores → your store → a product&apos;s URL, or import everything
            at once.
          </span>
        </label>
        <SubmitButton
          pendingText="Importing…"
          className="rounded-sm bg-accent-sun px-6 py-3 font-mono text-xs tracking-widest text-surface uppercase disabled:opacity-50"
        >
          Import from Printful
        </SubmitButton>
      </form>
    </div>
  );
}

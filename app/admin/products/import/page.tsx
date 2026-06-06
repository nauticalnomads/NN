import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { printfulConfigured, getStores, resolveStoreId, listSyncProducts } from "@/lib/printful";
import { createServiceClient } from "@/lib/supabase/service";
import { importFromPrintful } from "../actions";
import { SubmitButton } from "@/components/admin/SubmitButton";

export default async function PrintfulImport({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    skipped?: string;
    failed?: string;
    remaining?: string;
    error?: string;
  }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const configured = await printfulConfigured();

  // Connection check + the list of not-yet-imported sync products (so there's
  // no need to hunt for an id — just click Import).
  let conn:
    | { ok: true; stores: { id: number; name: string }[] }
    | { ok: false; error: string }
    | null = null;
  let available: { id: number; name: string; thumbnail_url?: string }[] | null = null;
  let availErr: string | null = null;
  if (configured) {
    try {
      conn = { ok: true, stores: await getStores() };
    } catch (e) {
      conn = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    try {
      const storeId = (await resolveStoreId()) ?? undefined;
      const all = await listSyncProducts(storeId);
      const sbv = createServiceClient();
      // Match already-imported products by provider id AND by name — the same
      // designs exist under different sync ids (other store / re-sync), so id
      // alone misses them and they'd wrongly show as "new".
      const { data: ex } = await sbv.from("products").select("provider_product_id, title");
      const rows = (ex as unknown as { provider_product_id: string | null; title: string }[]) ?? [];
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const haveIds = new Set(rows.map((r) => String(r.provider_product_id)));
      const haveNames = new Set(rows.map((r) => norm(r.title)));
      available = all.filter((p) => !haveIds.has(String(p.id)) && !haveNames.has(norm(p.name)));
    } catch (e) {
      availErr = e instanceof Error ? e.message : String(e);
    }
  }

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
        Products you publish in Printful appear here. Click <strong>Import</strong> to bring one in
        as a <strong>draft</strong> (mapped for fulfilment); then set its category &amp; price and
        publish.
      </p>

      {/* Connection status */}
      {configured && conn?.ok && (
        <div className="mt-6 rounded-sm border border-accent-sea/30 bg-accent-sea/5 px-4 py-3 font-body text-caption text-ink">
          ✓ Connected to Printful
          {conn.stores.length > 0 && (
            <>
              {" "}
              · Store{conn.stores.length > 1 ? "s" : ""}:{" "}
              <span className="font-mono">
                {conn.stores.map((s) => `${s.name} — ID ${s.id}`).join("; ")}
              </span>
            </>
          )}
        </div>
      )}
      {configured && conn && !conn.ok && (
        <div className="mt-6 rounded-sm border border-red-400/50 bg-red-50 px-4 py-3 font-body text-caption text-ink">
          Couldn&apos;t reach Printful: {conn.error}
        </div>
      )}
      {!configured && (
        <div className="mt-6 rounded-sm border border-accent-sun/40 bg-accent-sun/5 px-4 py-3 font-body text-caption text-ink">
          <strong>Printful API key is not set.</strong> Add it in{" "}
          <Link href="/admin/settings" className="text-accent-sun underline">
            Settings → POD integrations
          </Link>{" "}
          (or as a Cloudflare secret), then reload.
        </div>
      )}

      {/* Result / error banners */}
      {sp.error && (
        <div className="mt-6 rounded-sm border border-red-400/50 bg-red-50 px-4 py-3 font-body text-caption text-ink">
          {sp.error === "nokey" ? "Printful API key is not set." : sp.error}
        </div>
      )}
      {sp.created != null && (
        <div className="mt-6 rounded-sm border border-accent-sea/30 bg-accent-sea/5 px-4 py-3 font-body text-caption text-ink">
          Imported <strong>{sp.created}</strong> product(s); skipped {sp.skipped ?? 0}{" "}
          already-mapped
          {Number(sp.failed) > 0 && <>; {sp.failed} failed</>}.{" "}
          {Number(sp.remaining) > 0 && (
            <strong>{sp.remaining} remaining — click “Import all new” again to continue. </strong>
          )}
          <Link href="/admin/products" className="text-accent-sun underline">
            Review &amp; categorise →
          </Link>
        </div>
      )}

      {/* Not-yet-imported products */}
      {configured && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-caption tracking-wide text-ink/60 uppercase">
              New in Printful{available ? ` (${available.length})` : ""}
            </h2>
            {available && available.length > 0 && (
              <form action={importFromPrintful}>
                <SubmitButton
                  pendingText="Importing…"
                  className="rounded-sm border border-ink/25 px-3 py-1.5 font-mono text-xs tracking-widest text-ink/70 uppercase hover:border-accent-sun hover:text-accent-sun"
                >
                  Import all new
                </SubmitButton>
              </form>
            )}
          </div>

          {availErr && (
            <p className="mt-3 font-body text-caption text-red-600">
              Couldn&apos;t list products: {availErr}
            </p>
          )}
          {available && available.length === 0 && (
            <p className="mt-3 font-body text-body text-ink/50">
              All your Printful products are already imported. Publish a new one in Printful and it
              will appear here.
            </p>
          )}
          {available && available.length > 0 && (
            <ul className="mt-3 divide-y divide-ink/10 rounded-sm border border-ink/10">
              {available.slice(0, 100).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-driftwood">
                    {p.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-body text-ink">{p.name}</p>
                    <p className="font-mono text-[11px] text-ink/40">ID {p.id}</p>
                  </div>
                  <form action={importFromPrintful}>
                    <input type="hidden" name="sync_id" value={p.id} />
                    <SubmitButton
                      pendingText="…"
                      className="rounded-sm bg-accent-sun px-3 py-1.5 font-mono text-xs tracking-widest text-surface uppercase"
                    >
                      Import
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Manual id (fallback) */}
      <form action={importFromPrintful} className="mt-8 border-t border-ink/10 pt-6">
        <label className="block">
          <span className="font-mono text-caption tracking-wide text-ink/60 uppercase">
            …or import by ID
          </span>
          <input
            name="sync_id"
            placeholder="Printful sync product ID (or external/Shopify ID)"
            className="mt-1.5 block w-full rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body"
          />
        </label>
        <SubmitButton
          pendingText="Importing…"
          className="mt-3 rounded-sm border border-ink/25 px-5 py-2.5 font-mono text-xs tracking-widest text-ink/70 uppercase hover:border-accent-sun hover:text-accent-sun"
        >
          Import by ID
        </SubmitButton>
      </form>
    </div>
  );
}

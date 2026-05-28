import { requireStaff } from "@/lib/auth";
import { StubPage } from "@/components/admin/StubPage";

export default async function AdminCollections() {
  await requireStaff();
  return (
    <StubPage
      session="Session 04+"
      title="Collections"
      blurb="Create, sort and SEO-edit collections. Coming once the migration has filled the catalogue."
    />
  );
}

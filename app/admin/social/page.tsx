import { requireStaff } from "@/lib/auth";
import { StubPage } from "@/components/admin/StubPage";

export default async function AdminSocial() {
  await requireStaff();
  return (
    <StubPage
      session="Session 12"
      title="Social"
      blurb="Pick a photo from Drive, AI captions it in the brand voice, you review/edit, then publish or schedule via Make.com."
    />
  );
}

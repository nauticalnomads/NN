import { requireStaff } from "@/lib/auth";
import { StubPage } from "@/components/admin/StubPage";

export default async function AdminBlog() {
  await requireStaff();
  return (
    <StubPage
      session="Session 13"
      title="Blog"
      blurb="Auto-queued drafts from product publish + on-sale events, plus manual URL paste. Review, edit, schedule, publish."
    />
  );
}

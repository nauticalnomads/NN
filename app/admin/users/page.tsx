import { requireMaster } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setRole, inviteUser, deactivateUser } from "./actions";

export default async function UsersPage() {
  await requireMaster();
  const sb = await createClient();
  const { data } = await sb
    .from("users")
    .select("id, email, full_name, role, is_active, created_at")
    .order("created_at");
  const users =
    (data as unknown as Array<{
      id: string;
      email: string | null;
      full_name: string | null;
      role: string;
      is_active: boolean;
      created_at: string;
    }>) || [];

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-display-2 tracking-tight text-ink">Users</h1>
      <p className="mt-3 max-w-xl font-body text-body text-ink/60">
        Master only. Invite teammates and set their role.
      </p>

      <form action={inviteUser} className="mt-8 flex gap-3 border-y border-ink/10 py-6">
        <input
          name="email"
          type="email"
          required
          placeholder="teammate@example.com"
          className="flex-1 rounded-sm border border-ink/20 bg-surface px-3 py-2 font-body text-body text-ink"
        />
        <select
          name="role"
          defaultValue="content"
          className="rounded-sm border border-ink/20 bg-surface px-3 py-2 font-mono text-caption text-ink uppercase"
        >
          <option value="content">Content</option>
          <option value="regular">Regular</option>
          <option value="master">Master</option>
        </select>
        <button className="rounded-sm bg-accent-sun px-4 py-2 font-mono text-caption tracking-widest text-surface uppercase">
          Invite
        </button>
      </form>

      <div className="mt-8 space-y-3">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-sm border border-ink/10 p-4"
          >
            <div>
              <p className="font-body text-body text-ink">{u.full_name || u.email}</p>
              <p className="font-mono text-caption text-ink/50">
                {u.email} · {u.is_active ? "active" : "deactivated"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <form action={setRole}>
                <input type="hidden" name="id" value={u.id} />
                <select
                  name="role"
                  defaultValue={u.role}
                  className="rounded-sm border border-ink/20 bg-surface px-2 py-1 font-mono text-caption text-ink uppercase"
                >
                  <option value="content">Content</option>
                  <option value="regular">Regular</option>
                  <option value="master">Master</option>
                </select>
                <button className="ml-2 font-mono text-caption tracking-widest text-ink uppercase underline-offset-4 hover:underline">
                  Save
                </button>
              </form>
              <form action={deactivateUser}>
                <input type="hidden" name="id" value={u.id} />
                <button className="font-mono text-caption tracking-widest text-accent-sun uppercase underline-offset-4 hover:underline">
                  {u.is_active ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

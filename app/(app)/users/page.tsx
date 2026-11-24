import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { AddUserForm } from "./add-user-form";
import { UserActions } from "./user-actions";

export const dynamic = "force-dynamic";

type AllowedUser = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  added_by: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

export default async function UsersPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from("allowed_users")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <section className="panel">
      <h1>Users</h1>
      <p className="sub">
        Sign-in is Google only, and only emails on this list get in. Kindred
        and outside emails both work; the list decides, not the domain.
        Deactivating someone cuts their access on their next request.
      </p>

      {error ? (
        <p className="notice error">Couldn&apos;t load users: {error.message}</p>
      ) : (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Last sign-in</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(users as AllowedUser[]).map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="desc">{u.email}</span>
                    <br />
                    <span className="fine">
                      added {fmtDate(u.created_at)}
                      {u.added_by ? ` by ${u.added_by}` : ""}
                      {u.email === session.email ? " · that's you" : ""}
                    </span>
                  </td>
                  <td>{label(u.role)}</td>
                  <td>{u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : "Never"}</td>
                  <td>
                    {u.active ? (
                      <span className="pill ok">Active</span>
                    ) : (
                      <span className="pill off">Deactivated</span>
                    )}
                  </td>
                  <td>
                    {u.email !== session.email && (
                      <UserActions id={u.id} email={u.email} active={u.active} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2
        style={{
          fontFamily: "var(--display)",
          fontSize: 20,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 400,
          margin: "30px 0 10px",
        }}
      >
        Add a user
      </h2>
      <AddUserForm />
      <p className="sub" style={{ marginTop: 12, fontSize: 12 }}>
        Roles: <b>Admin</b> manages users and everything else · <b>Exec</b>{" "}
        full books, no user management · <b>Board</b> sees the Reports archive
        only. Only Admins see this tab.
      </p>
    </section>
  );
}

function label(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

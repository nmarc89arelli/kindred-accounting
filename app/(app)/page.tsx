import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/denied");
  if (session.role === "board") redirect("/reports");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  return (
    <section className="panel">
      <h1>Today</h1>
      <p className="sub">{today}. Everything that needs a decision, in one place.</p>
      <div className="todo">
        <div className="todo-row">
          <span className="t-num">·</span>
          <span className="t-body">
            <span className="desc">Phase 1 is live</span>
            <br />
            <span className="fine">
              Sign-in, the allowlist, and user management are working. Uncats,
              Reimbursements, and Reports arrive in Phase 2, and this list will
              fill with real work items.
            </span>
          </span>
          <span className="pill ok">Setup complete</span>
        </div>
      </div>
    </section>
  );
}

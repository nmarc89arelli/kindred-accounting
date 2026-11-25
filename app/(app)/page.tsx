import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { money, monthLabel } from "@/lib/reports";

export const dynamic = "force-dynamic";

function nowET(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
}

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/denied");
  if (session.role === "board") redirect("/reports");

  const now = nowET();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevPeriod = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;

  const supabase = await createClient();
  const { data: prevReport } = await supabase
    .from("reports")
    .select("id, totals, generated_at, token_hash")
    .eq("type", "giving")
    .eq("period", prevPeriod)
    .maybeSingle();

  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  type Totals = { grand: { amount: number } };

  return (
    <section className="panel">
      <h1>Today</h1>
      <p className="sub">{today}. Everything that needs a decision, in one place.</p>
      <div className="todo">
        {!prevReport ? (
          <div className="todo-row">
            <span className="t-num">1</span>
            <span className="t-body">
              <span className="desc">{monthLabel(prevPeriod)} giving report</span>
              <br />
              <span className="fine">
                The month has closed. Export transactions from Tithe.ly and
                generate the board report.
              </span>
            </span>
            <Link className="btn" href="/reports">
              Upload export
            </Link>
          </div>
        ) : (
          <div className="todo-row">
            <span className="t-num">·</span>
            <span className="t-body">
              <span className="desc">{monthLabel(prevPeriod)} giving report</span>
              <br />
              <span className="fine">
                Generated · {money((prevReport.totals as Totals).grand.amount)} total
                giving · board link {prevReport.token_hash ? "active" : "revoked"}
              </span>
            </span>
            <span className="pill ok">Done</span>
          </div>
        )}
        <div className="todo-row">
          <span className="t-num">·</span>
          <span className="t-body">
            <span className="desc">Uncats, reimbursements, board numbers</span>
            <br />
            <span className="fine">
              Arrive with the QuickBooks connection in Phase 3. This list will
              fill with real work items.
            </span>
          </span>
          <span className="pill warn">Scheduled</span>
        </div>
      </div>
    </section>
  );
}

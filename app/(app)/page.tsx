import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { money, monthLabel } from "@/lib/reports";
import { qboStatus } from "@/lib/qbo/auth";
import { countUncats } from "@/lib/qbo/uncats";

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
  const [{ data: prevReport }, { data: prevBoard }, { count: pendingReimb }, status] =
    await Promise.all([
      supabase
        .from("reports")
        .select("id, totals, token_hash")
        .eq("type", "giving")
        .eq("period", prevPeriod)
        .maybeSingle(),
      supabase
        .from("reports")
        .select("id")
        .eq("type", "board_numbers")
        .eq("period", prevPeriod)
        .maybeSingle(),
      supabase
        .from("reimbursements")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted"),
      qboStatus(),
    ]);

  let uncatCount: number | null = null;
  if (status.connected) {
    try {
      uncatCount = await countUncats();
    } catch {
      uncatCount = null;
    }
  }

  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  type Totals = { grand: { amount: number } };
  const nothingToDo =
    (uncatCount ?? 0) === 0 && (pendingReimb ?? 0) === 0 && !!prevReport;

  return (
    <section className="panel">
      <h1>Today</h1>
      <p className="sub">{today}. Everything that needs a decision, in one place.</p>
      <div className="todo">
        {!status.connected && (
          <div className="todo-row">
            <span className="t-num">!</span>
            <span className="t-body">
              <span className="desc">QuickBooks not connected</span>
              <br />
              <span className="fine">Uncats and reimbursement checks are paused until it is.</span>
            </span>
            {session.role === "admin" && (
              <Link className="btn" href="/settings">Connect</Link>
            )}
          </div>
        )}

        {uncatCount !== null && uncatCount > 0 && (
          <div className="todo-row">
            <span className="t-num">{uncatCount}</span>
            <span className="t-body">
              <span className="desc">
                Uncategorized transaction{uncatCount === 1 ? "" : "s"}
              </span>
              <br />
              <span className="fine">From the bank feed, waiting on a category.</span>
            </span>
            <Link className="btn" href="/uncats">Categorize</Link>
          </div>
        )}

        {(pendingReimb ?? 0) > 0 && (
          <div className="todo-row">
            <span className="t-num">{pendingReimb}</span>
            <span className="t-body">
              <span className="desc">
                Reimbursement{pendingReimb === 1 ? "" : "s"} waiting on a check
              </span>
              <br />
              <span className="fine">Write the check, then confirm it with its number.</span>
            </span>
            <Link className="btn" href="/reimbursements">Review</Link>
          </div>
        )}

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
            <Link className="btn" href="/reports">Upload export</Link>
          </div>
        ) : (
          <div className="todo-row">
            <span className="t-num">·</span>
            <span className="t-body">
              <span className="desc">{monthLabel(prevPeriod)} giving report</span>
              <br />
              <span className="fine">
                Generated · {money((prevReport.totals as Totals).grand.amount)}{" "}
                total giving · board link{" "}
                {prevReport.token_hash ? "active" : "revoked"}
              </span>
            </span>
            <span className="pill ok">Done</span>
          </div>
        )}

        {!prevBoard ? (
          <div className="todo-row">
            <span className="t-num">1</span>
            <span className="t-body">
              <span className="desc">{monthLabel(prevPeriod)} board numbers</span>
              <br />
              <span className="fine">
                The month has closed. Generate the board sheet from QuickBooks.
              </span>
            </span>
            <Link className="btn" href="/reports">Generate</Link>
          </div>
        ) : (
          <div className="todo-row">
            <span className="t-num">·</span>
            <span className="t-body">
              <span className="desc">{monthLabel(prevPeriod)} board numbers</span>
              <br />
              <span className="fine">Generated.</span>
            </span>
            <span className="pill ok">Done</span>
          </div>
        )}

        {nothingToDo && (
          <div className="todo-row">
            <span className="t-num">·</span>
            <span className="t-body">
              <span className="desc">Nothing needs you</span>
              <br />
              <span className="fine">Books are caught up.</span>
            </span>
            <span className="pill ok">Clear</span>
          </div>
        )}
      </div>
    </section>
  );
}

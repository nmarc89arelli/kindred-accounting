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

  return (
    <section className="panel">
      <div className="crumb">
        <span>{today}</span>
        <span className="chip">
          {status.connected ? "QuickBooks connected" : "QuickBooks not connected"}
        </span>
      </div>
      <h1>Today</h1>
      <p className="sub">Everything that needs a decision, in one place.</p>

      {!status.connected && (
        <p className="notice" style={{ marginBottom: 18 }}>
          QuickBooks is not connected, so uncats and reimbursement checks are
          paused.{" "}
          {session.role === "admin" && (
            <Link href="/settings" style={{ fontWeight: 700 }}>
              Connect it in Settings.
            </Link>
          )}
        </p>
      )}

      <div className="cards">
        {uncatCount !== null && (
          <div className={`card${uncatCount === 0 ? " done" : ""}`}>
            <div className="lbl">Uncategorized transactions</div>
            <div className="big">{uncatCount === 0 ? "Clear" : uncatCount}</div>
            <p className="fine">
              {uncatCount === 0
                ? "The bank feed is caught up."
                : "From the bank feed, waiting on a category."}
            </p>
            {uncatCount > 0 ? (
              <Link className="btn" href="/uncats">Categorize</Link>
            ) : (
              <Link className="btn ghost" href="/uncats">View</Link>
            )}
          </div>
        )}

        <div className={`card${(pendingReimb ?? 0) === 0 ? " done" : ""}`}>
          <div className="lbl">Reimbursements</div>
          <div className="big">
            {(pendingReimb ?? 0) === 0 ? "Clear" : pendingReimb}
          </div>
          <p className="fine">
            {(pendingReimb ?? 0) === 0
              ? "Nothing waiting on a check."
              : "Waiting on a check number."}
          </p>
          {(pendingReimb ?? 0) > 0 ? (
            <Link className="btn" href="/reimbursements">Review</Link>
          ) : (
            <Link className="btn ghost" href="/reimbursements">View</Link>
          )}
        </div>

        <div className={`card${prevReport ? " done" : ""}`}>
          <div className="lbl">{monthLabel(prevPeriod)} giving report</div>
          <div className="big">{prevReport ? "Done" : "Due"}</div>
          <p className="fine">
            {prevReport
              ? `${money((prevReport.totals as Totals).grand.amount)} total. Board link ${
                  prevReport.token_hash ? "active" : "revoked"
                }.`
              : "The month has closed. Upload the Tithe.ly export."}
          </p>
          {prevReport ? (
            <Link className="btn ghost" href={`/reports/${prevReport.id}`}>View</Link>
          ) : (
            <Link className="btn" href="/reports">Upload export</Link>
          )}
        </div>

        <div className={`card${prevBoard ? " done" : ""}`}>
          <div className="lbl">{monthLabel(prevPeriod)} board numbers</div>
          <div className="big">{prevBoard ? "Done" : "Due"}</div>
          <p className="fine">
            {prevBoard
              ? "Generated from QuickBooks."
              : "The month has closed. Generate the board sheet from QuickBooks."}
          </p>
          {prevBoard ? (
            <Link className="btn ghost" href={`/reports/${prevBoard.id}`}>View</Link>
          ) : (
            <Link className="btn" href="/reports">Generate</Link>
          )}
        </div>
      </div>
    </section>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { money, monthLabel, type Report } from "@/lib/reports";
import type { BoardTotals } from "@/lib/qbo/boardnumbers";
import { qboStatus } from "@/lib/qbo/auth";
import { UploadForm } from "./upload-form";
import { BoardForm } from "./board-form";
import { LinkControls } from "./link-controls";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/denied");

  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, type, period, title, totals, tx_count, token_hash, generated_by, generated_at")
    .order("period", { ascending: false });
  const reports = (data ?? []) as Report[];
  const staff = session.role === "admin" || session.role === "exec";
  const qboConnected = staff ? (await qboStatus()).connected : false;

  // Pre-fill the manual (non-QBO) balances from the latest board report.
  const latestBoard = reports.find((r) => r.type === "board_numbers");
  const manualDefaults = latestBoard
    ? ((latestBoard.totals as unknown as BoardTotals).balances ?? [])
        .filter((b) => b.source === "manual")
        .map((b) => ({ label: b.label, amount: b.amount }))
    : [];

  return (
    <section className="panel">
      <h1>Reports</h1>
      {staff ? (
        <>
          <p className="sub">
            Both monthly board reports: the board numbers sheet built live
            from QuickBooks, and the giving report from the Tithe.ly export.
            Each gets a private board link.
          </p>
          <h2 className="rpt-h">Board numbers · from QuickBooks</h2>
          {qboConnected ? (
            <BoardForm manualDefaults={manualDefaults} />
          ) : (
            <p className="notice">QuickBooks isn&apos;t connected (Settings).</p>
          )}
          <h2 className="rpt-h" style={{ marginTop: 34 }}>
            Giving report · from Tithe.ly
          </h2>
          <UploadForm />
        </>
      ) : (
        <p className="sub">Monthly reports for the board.</p>
      )}

      <h2 className="rpt-h" style={{ marginTop: 34 }}>
        Report archive
      </h2>
      {reports.length === 0 ? (
        <p className="notice">
          No reports yet.{staff ? " Upload a Tithe.ly export above to generate the first one." : ""}
        </p>
      ) : (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Report</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "right" }}>Net</th>
                <th>View</th>
                {staff && <th>Board link</th>}
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const isBoard = r.type === "board_numbers";
                const bt = isBoard ? (r.totals as unknown as BoardTotals) : null;
                return (
                <tr key={r.id}>
                  <td>
                    <span className="desc">{r.title}</span>
                    <br />
                    <span className="fine">
                      {isBoard
                        ? "QuickBooks P&L"
                        : `${r.tx_count} transactions`}{" "}
                      · generated{" "}
                      {new Date(r.generated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: "America/New_York",
                      })}{" "}
                      by {r.generated_by}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {isBoard ? `${money(bt!.totals.net)} net` : money(r.totals.grand.amount)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {isBoard ? "—" : money(r.totals.grand.net)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link className="btn ghost" href={`/reports/${r.id}`}>
                      Board view
                    </Link>{" "}
                    {staff && !isBoard && (
                      <a className="btn ghost" href={`/api/reports/${r.id}/workbook`}>
                        Excel (full)
                      </a>
                    )}
                  </td>
                  {staff && (
                    <td>
                      <LinkControls reportId={r.id} hasLink={r.token_hash !== null} />
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {staff && (
        <p className="sub" style={{ marginTop: 18, fontSize: 12 }}>
          Board links show the overview only, no donor names, and the link
          token is shown once when created or rotated. {monthLabel(currentPeriod())}{" "}
          closes at month end.
        </p>
      )}
    </section>
  );
}

function currentPeriod(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

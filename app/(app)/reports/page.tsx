import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { money, monthLabel, type Report } from "@/lib/reports";
import { UploadForm } from "./upload-form";
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

  return (
    <section className="panel">
      <h1>Reports</h1>
      {staff ? (
        <>
          <p className="sub">
            Upload the Tithe.ly transactions export and the monthly giving
            report is built, stored, and given a private board link. Board
            numbers from QuickBooks arrive in Phase 3.
          </p>
          <h2 className="rpt-h">Giving report · from Tithe.ly</h2>
          <UploadForm />
        </>
      ) : (
        <p className="sub">Monthly giving reports for the board.</p>
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
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="desc">{r.title}</span>
                    <br />
                    <span className="fine">
                      {r.tx_count} transactions · generated{" "}
                      {new Date(r.generated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: "America/New_York",
                      })}{" "}
                      by {r.generated_by}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>{money(r.totals.grand.amount)}</td>
                  <td style={{ textAlign: "right" }}>{money(r.totals.grand.net)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link className="btn ghost" href={`/reports/${r.id}`}>
                      Board view
                    </Link>{" "}
                    {staff && (
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
              ))}
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

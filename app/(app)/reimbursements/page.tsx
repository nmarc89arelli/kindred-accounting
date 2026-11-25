import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { qboStatus, QboDisconnectedError } from "@/lib/qbo/auth";
import { expenseAccounts, classes, type Option } from "@/lib/qbo/uncats";
import { bankAccounts } from "@/lib/qbo/checks";
import { ReimbursementRow, type Reimbursement } from "./row";

export const dynamic = "force-dynamic";

export default async function ReimbursementsPage() {
  const session = await getSession();
  if (!session) redirect("/denied");
  if (session.role === "board") redirect("/reports");

  const supabase = await createClient();
  const { data } = await supabase
    .from("reimbursements")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Reimbursement[];
  const pending = rows.filter((r) => r.status === "submitted");
  const done = rows.filter((r) => r.status !== "submitted");

  const status = await qboStatus();
  let accounts: Option[] = [];
  let classOpts: Option[] = [];
  let banks: Option[] = [];
  let qboError: string | null = null;
  if (status.connected && pending.length > 0) {
    try {
      [accounts, classOpts, banks] = await Promise.all([
        expenseAccounts(),
        classes(),
        bankAccounts(),
      ]);
    } catch (e) {
      qboError =
        e instanceof QboDisconnectedError
          ? e.message
          : `QuickBooks data unavailable: ${(e as Error).message}`;
    }
  }

  return (
    <section className="panel">
      <h1>Reimbursements{pending.length > 0 ? ` · ${pending.length}` : ""}</h1>
      <p className="sub">
        Expense submissions from the intranet form. Write the physical check,
        then confirm it here with the check number: the app records the check
        in QuickBooks so the bank feed auto-matches when it clears.
      </p>

      {!status.connected && pending.length > 0 && (
        <p className="notice error">
          QuickBooks isn&apos;t connected, so confirming is disabled.{" "}
          {session.role === "admin" ? (
            <Link href="/settings">Connect it in Settings.</Link>
          ) : (
            "Ask Nate to connect it."
          )}
        </p>
      )}
      {qboError && <p className="notice error">{qboError}</p>}

      {pending.length === 0 ? (
        <p className="notice">
          No reimbursements waiting. New intranet submissions appear here
          automatically.
        </p>
      ) : (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Request</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Category / Class / Account</th>
                <th>Check #</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <ReimbursementRow
                  key={r.id}
                  row={r}
                  accounts={accounts}
                  classOptions={classOpts}
                  banks={banks}
                  canConfirm={status.connected && !qboError}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {done.length > 0 && (
        <>
          <h2 className="rpt-h" style={{ marginTop: 34 }}>
            History
          </h2>
          <div className="tscroll">
            <table>
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Request</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Check #</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {done.map((r) => (
                  <tr key={r.id} style={{ color: "var(--muted)" }}>
                    <td>{fmt(r.submitted_at)}</td>
                    <td>
                      <span className="desc">{r.name}</span>
                      <br />
                      <span className="fine">
                        {r.description.slice(0, 80)}
                        {r.category_name ? ` · ${r.category_name}` : ""}
                        {r.class_name ? ` / ${r.class_name}` : ""}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {Number(r.amount).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </td>
                    <td>{r.check_number ?? "—"}</td>
                    <td>
                      {r.status === "check_written" ? (
                        <span className="pill ok">Check written</span>
                      ) : (
                        <span className="pill off">Voided</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

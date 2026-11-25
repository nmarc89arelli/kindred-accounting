import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";
import { QboDisconnectedError, qboStatus } from "@/lib/qbo/auth";
import {
  classes,
  expenseAccounts,
  incomeAccounts,
  listUncats,
  type UncatTxn,
} from "@/lib/qbo/uncats";
import { UncatRow } from "./row";

export const dynamic = "force-dynamic";

export default async function UncatsPage() {
  const session = await getSession();
  if (!session) redirect("/denied");
  if (session.role === "board") redirect("/reports");

  const status = await qboStatus();
  if (!status.connected) {
    return (
      <section className="panel">
        <h1>Uncats</h1>
        <p className="notice">
          QuickBooks isn&apos;t connected.{" "}
          {session.role === "admin" ? (
            <Link href="/settings">Connect it in Settings.</Link>
          ) : (
            "Ask Nate to connect it in Settings."
          )}
        </p>
      </section>
    );
  }

  let rows: UncatTxn[] = [];
  let expenseOpts: { id: string; name: string }[] = [];
  let incomeOpts: { id: string; name: string }[] = [];
  let classOpts: { id: string; name: string }[] = [];
  let loadError: string | null = null;

  try {
    [rows, expenseOpts, incomeOpts, classOpts] = await Promise.all([
      listUncats(),
      expenseAccounts(),
      incomeAccounts(),
      classes(),
    ]);
  } catch (e) {
    loadError =
      e instanceof QboDisconnectedError
        ? e.message
        : `Couldn't load from QuickBooks: ${(e as Error).message}`;
  }

  return (
    <section className="panel">
      <h1>Uncats{rows.length > 0 ? ` · ${rows.length}` : ""}</h1>
      <p className="sub">
        Everything the bank feed added as uncategorized. Pick the category and
        class, post it, and it&apos;s written straight into QuickBooks.
        Recurring payees get a suggested category from the last 18 months of
        history.
      </p>

      {loadError ? (
        <p className="notice error">{loadError}</p>
      ) : rows.length === 0 ? (
        <p className="notice">
          Nothing uncategorized. Either the books are caught up, or the bank
          feed rules aren&apos;t adding transactions to Uncategorized Expense /
          Income yet (QuickBooks → Transactions → Rules).
        </p>
      ) : (
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Category</th>
                <th>Class</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <UncatRow
                  key={`${r.txnType}-${r.id}`}
                  txn={r}
                  accounts={r.txnType === "Purchase" ? expenseOpts : incomeOpts}
                  classOptions={classOpts}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

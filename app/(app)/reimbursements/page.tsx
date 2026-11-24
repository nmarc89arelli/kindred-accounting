import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";

export default async function ReimbursementsPage() {
  const session = await getSession();
  if (!session) redirect("/denied");
  if (session.role === "board") redirect("/reports");

  return (
    <section className="panel">
      <h1>Reimbursements</h1>
      <p className="sub">Expense submissions waiting on a check number. Confirming one creates the check in QuickBooks so the bank feed auto-matches. Arrives in Phase 3.</p>
    </section>
  );
}

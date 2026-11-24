import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/denied");

  return (
    <section className="panel">
      <h1>Reports</h1>
      <p className="sub">Monthly board reports: the giving report from the Tithe.ly export and the board numbers sheet from QuickBooks, each with a private board share link. Arrives in Phase 2, next code drop.</p>
    </section>
  );
}

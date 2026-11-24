import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";

export default async function UncatsPage() {
  const session = await getSession();
  if (!session) redirect("/denied");
  if (session.role === "board") redirect("/reports");

  return (
    <section className="panel">
      <h1>Uncats</h1>
      <p className="sub">Uncategorized transactions from the QuickBooks feed land here for one-tap categorizing. Arrives in Phase 3, once the QuickBooks connection is approved.</p>
    </section>
  );
}

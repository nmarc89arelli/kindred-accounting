import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";

export default async function AskPage() {
  const session = await getSession();
  if (!session) redirect("/denied");
  if (session.role === "board") redirect("/reports");

  return (
    <section className="panel">
      <h1>Ask</h1>
      <p className="sub">Plain-language questions answered from live QuickBooks data, read only. Arrives in Phase 4.</p>
    </section>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";
import { AskClient } from "./ask-client";

export default async function AskPage() {
  const session = await getSession();
  if (!session) redirect("/denied");
  if (session.role === "board") redirect("/reports");

  return (
    <section className="panel">
      <h1>Ask</h1>
      <p className="sub">
        Plain questions, answered from the live books. Read only: nothing
        asked here can ever change QuickBooks. Treat answers as a fast first
        look, and the Reports tab as the official numbers.
      </p>
      <AskClient />
    </section>
  );
}

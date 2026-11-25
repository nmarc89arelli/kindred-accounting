import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { BoardReport } from "@/components/board-report";
import type { Report } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/denied");
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, period, totals, tx_count, generated_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const report = data as Pick<Report, "id" | "period" | "totals" | "tx_count" | "generated_at">;

  return (
    <section className="panel">
      <BoardReport
        period={report.period}
        totals={report.totals}
        generatedAt={report.generated_at}
        txCount={report.tx_count}
      />
      <p style={{ marginTop: 18 }}>
        <a className="btn" href={`/api/reports/${report.id}/overview`}>
          Download Excel (overview)
        </a>{" "}
        {(session.role === "admin" || session.role === "exec") && (
          <a className="btn ghost" href={`/api/reports/${report.id}/workbook`}>
            Download Excel (full, donor detail)
          </a>
        )}
      </p>
    </section>
  );
}

import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { BoardReport } from "@/components/board-report";
import { BoardNumbers } from "@/components/board-numbers";
import type { Report } from "@/lib/reports";
import type { BoardTotals } from "@/lib/qbo/boardnumbers";

export const dynamic = "force-dynamic";

function priorPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

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
    .select("id, type, period, totals, tx_count, generated_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const report = data as Pick<
    Report,
    "id" | "type" | "period" | "totals" | "tx_count" | "generated_at"
  >;

  if (report.type === "board_numbers") {
    const { data: prior } = await supabase
      .from("reports")
      .select("period, totals")
      .eq("type", "board_numbers")
      .eq("period", priorPeriod(report.period))
      .maybeSingle();

    return (
      <section className="panel">
        <BoardNumbers
          period={report.period}
          totals={report.totals as unknown as BoardTotals}
          generatedAt={report.generated_at}
          prior={(prior?.totals as unknown as BoardTotals) ?? null}
          priorPeriod={prior ? prior.period : undefined}
        />
        <p style={{ marginTop: 18 }}>
          <a className="btn" href={`/api/reports/${report.id}/overview`}>
            Download Excel
          </a>
        </p>
      </section>
    );
  }

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

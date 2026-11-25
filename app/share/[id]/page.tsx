import Image from "next/image";
import { headers } from "next/headers";
import { fetchReportById, logReportView } from "@/lib/reports";
import { tokenMatches } from "@/lib/share";
import { BoardReport } from "@/components/board-report";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  const report = /^[0-9a-f-]{36}$/.test(id) ? await fetchReportById(id) : null;
  const ok = report !== null && tokenMatches(t ?? "", report.token_hash);

  if (!ok) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <Image src="/kindred-logo-green.png" alt="Kindred Church" width={194} height={34} />
          <h1>Link not valid</h1>
          <p>
            This report link is no longer active. Contact the church office for
            a current one.
          </p>
        </div>
      </div>
    );
  }

  const h = await headers();
  await logReportView(
    report.id,
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "",
    h.get("user-agent") ?? ""
  );

  return (
    <div className="wrap">
      <header className="app">
        <Image src="/kindred-logo-white.png" alt="Kindred Church" width={171} height={30} priority />
      </header>
      <section className="panel">
        <BoardReport
          period={report.period}
          totals={report.totals}
          generatedAt={report.generated_at}
          txCount={report.tx_count}
        />
        <p style={{ marginTop: 18 }}>
          <a className="btn" href={`/share/${report.id}/download?t=${encodeURIComponent(t ?? "")}`}>
            Download Excel (overview)
          </a>
        </p>
      </section>
    </div>
  );
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/roles";
import { fetchReportById, fetchReportRows, monthLabel } from "@/lib/reports";
import { buildExecWorkbook } from "@/lib/workbook";
import type { GivingRow } from "@/lib/tithely";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "exec")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const report = await fetchReportById(id);
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = (await fetchReportRows(id)) as GivingRow[];
  const buf = await buildExecWorkbook(report.period, rows, report.totals);

  const name = `Church_${monthLabel(report.period).replace(" ", "_")}_-_Legacy_Builders_Tithes_and_Offerings.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

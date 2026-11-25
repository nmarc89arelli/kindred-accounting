import { NextResponse } from "next/server";
import { getSession } from "@/lib/roles";
import { fetchReportById, monthLabel } from "@/lib/reports";
import { buildBoardWorkbook } from "@/lib/workbook";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const report = await fetchReportById(id);
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = await buildBoardWorkbook(report.period, report.totals);
  const name = `Kindred_Giving_Overview_${monthLabel(report.period).replace(" ", "_")}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { fetchReportById, monthLabel } from "@/lib/reports";
import { tokenMatches } from "@/lib/share";
import { buildBoardWorkbook } from "@/lib/workbook";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const t = new URL(req.url).searchParams.get("t") ?? "";

  const report = /^[0-9a-f-]{36}$/.test(id) ? await fetchReportById(id) : null;
  if (!report || !tokenMatches(t, report.token_hash)) {
    return NextResponse.json({ error: "Link not valid" }, { status: 403 });
  }

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

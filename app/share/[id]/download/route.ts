import { NextResponse } from "next/server";
import { fetchReportById, monthLabel } from "@/lib/reports";
import { tokenMatches } from "@/lib/share";
import { buildBoardWorkbook, buildBoardNumbersWorkbook } from "@/lib/workbook";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BoardTotals } from "@/lib/qbo/boardnumbers";

function priorPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

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

  let buf: Buffer;
  let name: string;
  if (report.type === "board_numbers") {
    const admin = createAdminClient();
    const { data: prior } = await admin
      .from("reports")
      .select("period, totals")
      .eq("type", "board_numbers")
      .eq("period", priorPeriod(report.period))
      .maybeSingle();
    buf = await buildBoardNumbersWorkbook(
      report.period,
      report.totals as unknown as BoardTotals,
      prior
        ? { period: prior.period, totals: prior.totals as unknown as BoardTotals }
        : null
    );
    name = `Kindred_Board_Numbers_${monthLabel(report.period).replace(" ", "_")}.xlsx`;
  } else {
    buf = await buildBoardWorkbook(report.period, report.totals);
    name = `Kindred_Giving_Overview_${monthLabel(report.period).replace(" ", "_")}.xlsx`;
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

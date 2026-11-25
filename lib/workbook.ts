import "server-only";
import ExcelJS from "exceljs";
import type { GivingRow, GivingTotals } from "@/lib/tithely";
import type { BoardTotals, MoneyLine } from "@/lib/qbo/boardnumbers";

// Excel formula injection guard: a cell value starting with = + - @ gets a
// leading apostrophe so donor names and bank descriptors can never execute.
function safe(v: string): string {
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

const GREEN = "FF2E5339";
const SOFT = "FFF2F7F4";
const RED = "FF8B0000";
const RED_SOFT = "FFE8D6D6";
const HEADER_BLUE = "FF305496";
const MONEY = '"$"#,##0.00';

const monthName = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`;
};

function fill(color: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: color } };
}

function excelDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addGivingSheet(
  wb: ExcelJS.Workbook,
  name: string,
  rows: GivingRow[]
) {
  const ws = wb.addWorksheet(name);
  const headers = [
    "Currency Code", "Amount", "First Name", "Last Name", "Full Name",
    "Location Name", "Transaction Date", "Transaction Time", "Fees", "Status",
    "Net Amount", "Covered Fees", "Fund Name", "Deposit Date", "Deposit Time",
    "Payment Type", "Payment Method",
  ];
  const widths = [16, 12, 12, 16, 20, 16, 20, 14, 10, 12, 12, 12, 16, 14, 12, 12, 39];
  ws.addRow(headers);
  ws.getRow(1).eachCell((c) => {
    c.font = { name: "Roboto", size: 11, color: { argb: "FFFFFFFF" } };
    c.fill = fill(HEADER_BLUE);
  });
  headers.forEach((_, i) => (ws.getColumn(i + 1).width = widths[i]));

  rows.forEach((r, i) => {
    const n = i + 2;
    const fullName = `${r.first_name} ${r.last_name}`.trim();
    const row = ws.addRow([
      "USD", r.amount, safe(r.first_name), safe(r.last_name),
      { formula: `C${n} & " " & D${n}`, result: fullName },
      safe(r.location || "Kindred Church"),
      excelDate(r.tx_date), r.tx_time, r.fees, r.status, r.net_amount,
      r.covered_fees ? 1 : null, safe(r.fund),
      r.deposit_date ? excelDate(r.deposit_date) : null,
      r.deposit_time, r.payment_type, safe(r.payment_method),
    ]);
    row.eachCell((c) => (c.font = { name: "Roboto", size: 10 }));
    row.getCell(7).numFmt = "m/d/yy";
    if (r.deposit_date) row.getCell(14).numFmt = "m/d/yy";
  });
  ws.autoFilter = { from: "A1", to: { row: 1, column: headers.length } };
  return ws;
}

// Full exec workbook: Dashboard + Giving + Failed Payments, matching the
// approved monthly format.
export async function buildExecWorkbook(
  period: string,
  rows: GivingRow[],
  totals: GivingTotals
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const label = monthName(period);

  const d = wb.addWorksheet("Dashboard");
  [48.71, 18.71, 18.29, 25.57, 28.29, 22, 16].forEach(
    (w, i) => (d.getColumn(i + 1).width = w)
  );

  d.getCell("A1").value = "Church Giving Dashboard";
  d.getCell("A1").font = { name: "Roboto", size: 16, bold: true, color: { argb: GREEN } };
  d.getCell("A2").value = `Summary of ${label} Giving`;
  d.getCell("A2").font = { name: "Roboto", size: 13, bold: true };
  d.getCell("F2").value = `Summary of ${label} Failed Payments`;
  d.getCell("F2").font = { name: "Roboto", size: 13, bold: true };

  const head = (cell: string, text: string, color = GREEN) => {
    const c = d.getCell(cell);
    c.value = text;
    c.font = { name: "Roboto", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = fill(color);
  };
  head("A4", "Fund Name");
  head("B4", "Sum of Amount");
  head("C4", "Sum of Fees");
  head("D4", "Sum of Net Amount");
  head("F4", "Full Name", RED);
  head("G4", "SUM of Amount", RED);

  let r = 5;
  for (const f of totals.funds) {
    d.getCell(`A${r}`).value = safe(f.fund);
    d.getCell(`A${r}`).font = { name: "Roboto", size: 11, bold: true };
    d.getCell(`B${r}`).value = {
      formula: `SUMIFS(Giving!$B:$B,Giving!$M:$M,A${r},Giving!$J:$J,"succeeded")+SUMIFS(Giving!$B:$B,Giving!$M:$M,A${r},Giving!$J:$J,"pending")`,
      result: f.amount,
    };
    d.getCell(`C${r}`).value = {
      formula: `SUMIFS(Giving!$I:$I,Giving!$M:$M,A${r},Giving!$J:$J,"succeeded")+SUMIFS(Giving!$I:$I,Giving!$M:$M,A${r},Giving!$J:$J,"pending")`,
      result: f.fees,
    };
    d.getCell(`D${r}`).value = { formula: `B${r}-C${r}`, result: f.net };
    ["A", "B", "C", "D"].forEach((col) => {
      d.getCell(`${col}${r}`).fill = fill(SOFT);
      if (col !== "A") d.getCell(`${col}${r}`).numFmt = MONEY;
    });
    r += 1;
  }

  const totalRow = r;
  d.getCell(`A${totalRow}`).value = "Grand Total";
  d.getCell(`B${totalRow}`).value = {
    formula: `SUM(B5:B${totalRow - 1})`,
    result: totals.grand.amount,
  };
  d.getCell(`C${totalRow}`).value = {
    formula: `SUM(C5:C${totalRow - 1})`,
    result: totals.grand.fees,
  };
  d.getCell(`D${totalRow}`).value = {
    formula: `B${totalRow}-C${totalRow}`,
    result: totals.grand.net,
  };
  ["A", "B", "C", "D"].forEach((col) => {
    const c = d.getCell(`${col}${totalRow}`);
    c.font = { name: "Roboto", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = fill(GREEN);
    if (col !== "A") c.numFmt = MONEY;
  });

  const tocRow = totalRow + 2;
  d.getCell(`A${tocRow}`).value = "Tithes, Offerings & Charity Giving:";
  d.getCell(`A${tocRow}`).font = { name: "Roboto", bold: true };
  const tocFormula = (col: "B" | "I") =>
    ["Tithe", "Offering", "Charity Giving"]
      .flatMap((f) => ["succeeded", "pending"].map(
        (s) => `SUMIFS(Giving!$${col}:$${col},Giving!$M:$M,"${f}",Giving!$J:$J,"${s}")`
      ))
      .join("+");
  d.getCell(`B${tocRow}`).value = { formula: tocFormula("B"), result: totals.toc.amount };
  d.getCell(`C${tocRow}`).value = { formula: tocFormula("I"), result: totals.toc.fees };
  d.getCell(`D${tocRow}`).value = { formula: `B${tocRow}-C${tocRow}`, result: totals.toc.net };
  ["B", "C", "D"].forEach((col) => {
    d.getCell(`${col}${tocRow}`).numFmt = MONEY;
    d.getCell(`${col}${tocRow}`).fill = fill(SOFT);
    d.getCell(`${col}${tocRow}`).font = { name: "Roboto", size: 11, bold: true };
  });

  let fr = 5;
  for (const f of totals.failed.names) {
    d.getCell(`F${fr}`).value = safe(f.name);
    d.getCell(`G${fr}`).value = {
      formula: `SUMIFS(Giving!$B:$B,Giving!$E:$E,F${fr},Giving!$J:$J,"failed")`,
      result: f.amount,
    };
    d.getCell(`F${fr}`).fill = fill(SOFT);
    d.getCell(`G${fr}`).fill = fill(SOFT);
    d.getCell(`G${fr}`).numFmt = MONEY;
    fr += 1;
  }
  const ftRow = Math.max(fr, 13);
  d.getCell(`F${ftRow}`).value = "Grand Total";
  d.getCell(`F${ftRow}`).font = { name: "Roboto", size: 11, bold: true };
  d.getCell(`F${ftRow}`).fill = fill(RED_SOFT);
  d.getCell(`G${ftRow}`).value = {
    formula: `SUM(G5:G${ftRow - 1})`,
    result: totals.failed.amount,
  };
  d.getCell(`G${ftRow}`).fill = fill(RED_SOFT);
  d.getCell(`G${ftRow}`).font = { name: "Roboto", size: 11, bold: true };
  d.getCell(`G${ftRow}`).numFmt = MONEY;

  addGivingSheet(wb, "Giving", rows);
  addGivingSheet(wb, "Failed Payments", rows.filter((x) => x.status === "failed"));

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Board overview: one sheet, fund summary only, no donor names anywhere,
// failed payments as count + total.
export async function buildBoardWorkbook(
  period: string,
  totals: GivingTotals
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const label = monthName(period);
  const ws = wb.addWorksheet("Overview");
  [40, 18, 18, 18].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.getCell("A1").value = "Kindred Church · Giving Report";
  ws.getCell("A1").font = { name: "Roboto", size: 16, bold: true, color: { argb: GREEN } };
  ws.getCell("A2").value = `${label} · Overview (no donor detail)`;
  ws.getCell("A2").font = { name: "Roboto", size: 12, bold: true };

  const head = (cell: string, text: string) => {
    const c = ws.getCell(cell);
    c.value = text;
    c.font = { name: "Roboto", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = fill(GREEN);
  };
  head("A4", "Fund");
  head("B4", "Amount");
  head("C4", "Fees");
  head("D4", "Net");

  let r = 5;
  for (const f of totals.funds) {
    ws.getCell(`A${r}`).value = safe(f.fund);
    ws.getCell(`B${r}`).value = f.amount;
    ws.getCell(`C${r}`).value = f.fees;
    ws.getCell(`D${r}`).value = f.net;
    ["B", "C", "D"].forEach((c) => (ws.getCell(`${c}${r}`).numFmt = MONEY));
    ["A", "B", "C", "D"].forEach((c) => (ws.getCell(`${c}${r}`).fill = fill(SOFT)));
    r += 1;
  }
  ws.getCell(`A${r}`).value = "Grand Total";
  ws.getCell(`B${r}`).value = totals.grand.amount;
  ws.getCell(`C${r}`).value = totals.grand.fees;
  ws.getCell(`D${r}`).value = totals.grand.net;
  ["A", "B", "C", "D"].forEach((c) => {
    ws.getCell(`${c}${r}`).font = { name: "Roboto", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell(`${c}${r}`).fill = fill(GREEN);
    if (c !== "A") ws.getCell(`${c}${r}`).numFmt = MONEY;
  });

  r += 2;
  ws.getCell(`A${r}`).value = "Tithes, Offerings & Charity Giving";
  ws.getCell(`A${r}`).font = { name: "Roboto", bold: true };
  ws.getCell(`B${r}`).value = totals.toc.amount;
  ws.getCell(`B${r}`).numFmt = MONEY;
  r += 1;
  ws.getCell(`A${r}`).value = "Transactions";
  ws.getCell(`B${r}`).value = totals.txCount;
  r += 1;
  ws.getCell(`A${r}`).value = "Failed payments";
  ws.getCell(`B${r}`).value = totals.failed.count;
  ws.getCell(`C${r}`).value = totals.failed.amount;
  ws.getCell(`C${r}`).numFmt = MONEY;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Board numbers workbook: one sheet, income / expense sections / net /
// balances, with an optional prior-month column.
export async function buildBoardNumbersWorkbook(
  period: string,
  totals: BoardTotals,
  prior?: { period: string; totals: BoardTotals } | null
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Board Numbers");
  const cols = prior ? [42, 18, 18] : [42, 18];
  cols.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.getCell("A1").value = "Kindred Church · Board Numbers";
  ws.getCell("A1").font = { name: "Roboto", size: 16, bold: true, color: { argb: GREEN } };
  ws.getCell("A2").value = `${monthName(period)} · Source: QuickBooks Statement of Activity`;
  ws.getCell("A2").font = { name: "Roboto", size: 11, bold: true };

  const priorMap = new Map<string, number>();
  const addPrior = (lines: MoneyLine[], prefix: string) => {
    for (const l of lines) {
      priorMap.set(prefix + l.label, l.amount);
      if (l.lines) addPrior(l.lines, `${prefix}${l.label} > `);
    }
  };
  if (prior) {
    addPrior([...prior.totals.income, ...prior.totals.otherIncome], "Income|");
    addPrior(prior.totals.expenseSections, "Expenses|");
  }

  let r = 4;
  const head = (text: string) => {
    ws.getCell(`A${r}`).value = text;
    ws.getCell(`A${r}`).font = { name: "Roboto", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell(`A${r}`).fill = fill(GREEN);
    ws.getCell(`B${r}`).value = monthName(period);
    ws.getCell(`B${r}`).font = { name: "Roboto", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    ws.getCell(`B${r}`).fill = fill(GREEN);
    if (prior) {
      ws.getCell(`C${r}`).value = monthName(prior.period);
      ws.getCell(`C${r}`).font = { name: "Roboto", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      ws.getCell(`C${r}`).fill = fill(GREEN);
    }
    r += 1;
  };
  const line = (label: string, amount: number, key = "", depth = 0, bold = false) => {
    ws.getCell(`A${r}`).value = safe(label);
    if (depth > 0) ws.getCell(`A${r}`).alignment = { indent: depth };
    ws.getCell(`B${r}`).value = amount;
    ws.getCell(`B${r}`).numFmt = MONEY;
    if (prior && key && priorMap.has(key)) {
      ws.getCell(`C${r}`).value = priorMap.get(key);
      ws.getCell(`C${r}`).numFmt = MONEY;
    }
    if (bold) {
      ["A", "B"].forEach((c) => {
        ws.getCell(`${c}${r}`).font = { name: "Roboto", size: 11, bold: true };
      });
    }
    r += 1;
  };
  const writeLines = (lines: MoneyLine[], prefix: string, depth = 0) => {
    for (const l of lines) {
      const key = prefix + l.label;
      line(l.label, l.amount, key, depth, !!l.lines);
      if (l.lines) writeLines(l.lines, `${key} > `, depth + 1);
    }
  };
  const totalLine = (label: string, cur: number, prev?: number) => {
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`B${r}`).value = cur;
    ws.getCell(`B${r}`).numFmt = MONEY;
    if (prior && prev !== undefined) {
      ws.getCell(`C${r}`).value = prev;
      ws.getCell(`C${r}`).numFmt = MONEY;
    }
    (prior ? ["A", "B", "C"] : ["A", "B"]).forEach((c) => {
      ws.getCell(`${c}${r}`).font = { name: "Roboto", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      ws.getCell(`${c}${r}`).fill = fill(GREEN);
    });
    r += 1;
  };

  head("Income");
  writeLines([...totals.income, ...totals.otherIncome], "Income|");
  totalLine("Total income", totals.totals.income, prior?.totals.totals.income);
  r += 1;
  head("Expenses");
  writeLines(totals.expenseSections, "Expenses|");
  totalLine("Total expenses", totals.totals.expenses, prior?.totals.totals.expenses);
  r += 1;
  totalLine("Net income", totals.totals.net, prior?.totals.totals.net);
  r += 1;
  head("Account balances (as of generation)");
  for (const b of totals.balances) {
    line(b.source === "manual" ? `${b.label} (reported)` : b.label, b.amount);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

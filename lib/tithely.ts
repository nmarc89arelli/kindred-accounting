import Papa from "papaparse";

export type GivingRow = {
  amount: number;
  first_name: string;
  last_name: string;
  location: string;
  tx_date: string; // ISO yyyy-mm-dd
  tx_time: string;
  fees: number;
  status: string;
  net_amount: number;
  covered_fees: boolean;
  fund: string;
  deposit_date: string | null;
  deposit_time: string | null;
  payment_type: string;
  payment_method: string;
};

export type FundTotal = { fund: string; amount: number; fees: number; net: number };

export type GivingTotals = {
  funds: FundTotal[];
  grand: { amount: number; fees: number; net: number };
  // Tithes, Offerings & Charity Giving combined (excludes Legacy Builders)
  toc: { amount: number; fees: number; net: number };
  txCount: number;
  failed: {
    count: number;
    amount: number;
    names: { name: string; amount: number }[]; // exec rendition only
  };
};

const REQUIRED_HEADERS = [
  "Amount",
  "First Name",
  "Last Name",
  "Transaction Date",
  "Fees",
  "Status",
  "Net Amount",
  "Fund Name",
];

// Statuses counted toward totals, matching the approved September/October
// methodology: succeeded and pending count, failed is listed separately.
const COUNTED = new Set(["succeeded", "pending"]);
const TOC_FUNDS = new Set(["Tithe", "Offering", "Charity Giving"]);

function num(v: string | undefined): number {
  const s = (v ?? "").replace(/,/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`Bad number in CSV: "${v}"`);
  return Math.round(n * 100) / 100;
}

function isoDate(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) throw new Error(`Bad date in CSV: "${v}"`);
  const yy = Number(m[3]);
  const year = yy < 100 ? 2000 + yy : yy;
  const mm = String(Number(m[1])).padStart(2, "0");
  const dd = String(Number(m[2])).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function parseTithelyCsv(csvText: string): {
  rows: GivingRow[];
  errors: string[];
} {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = [];
  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) {
    return {
      rows: [],
      errors: [
        `This doesn't look like a Tithe.ly transactions export. Missing columns: ${missing.join(", ")}.`,
      ],
    };
  }

  const rows: GivingRow[] = [];
  parsed.data.forEach((r, i) => {
    try {
      const txDate = isoDate(r["Transaction Date"]);
      if (!txDate) return; // blank trailing rows
      rows.push({
        amount: num(r["Amount"]),
        first_name: (r["First Name"] ?? "").trim(),
        last_name: (r["Last Name"] ?? "").trim(),
        location: (r["Location"] ?? r["Location Name"] ?? "").trim(),
        tx_date: txDate,
        tx_time: (r["Transaction Time"] ?? "").trim(),
        fees: num(r["Fees"]),
        status: (r["Status"] ?? "").trim().toLowerCase(),
        net_amount: num(r["Net Amount"]),
        covered_fees: (r["Covered Fees"] ?? "").trim() !== "",
        fund: (r["Fund Name"] ?? "").trim(),
        deposit_date: isoDate(r["Deposit Date"]),
        deposit_time: (r["Deposit Time"] ?? "").trim() || null,
        payment_type: (r["Payment Type"] ?? "").trim(),
        payment_method: (r["Payment Method"] ?? "").trim(),
      });
    } catch (e) {
      errors.push(`Row ${i + 2}: ${(e as Error).message}`);
    }
  });

  return { rows, errors };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeTotals(rows: GivingRow[]): GivingTotals {
  const fundMap = new Map<string, FundTotal>();
  const grand = { amount: 0, fees: 0, net: 0 };
  const toc = { amount: 0, fees: 0, net: 0 };
  const failedBy = new Map<string, number>();
  let failedAmount = 0;
  let failedCount = 0;

  for (const row of rows) {
    if (COUNTED.has(row.status)) {
      let f = fundMap.get(row.fund);
      if (!f) {
        f = { fund: row.fund, amount: 0, fees: 0, net: 0 };
        fundMap.set(row.fund, f);
      }
      f.amount = r2(f.amount + row.amount);
      f.fees = r2(f.fees + row.fees);
      grand.amount = r2(grand.amount + row.amount);
      grand.fees = r2(grand.fees + row.fees);
      if (TOC_FUNDS.has(row.fund)) {
        toc.amount = r2(toc.amount + row.amount);
        toc.fees = r2(toc.fees + row.fees);
      }
    } else if (row.status === "failed") {
      failedCount += 1;
      failedAmount = r2(failedAmount + row.amount);
      const name = `${row.first_name} ${row.last_name}`.trim() || "Unknown";
      failedBy.set(name, r2((failedBy.get(name) ?? 0) + row.amount));
    }
  }

  const funds = [...fundMap.values()]
    .map((f) => ({ ...f, net: r2(f.amount - f.fees) }))
    .sort((a, b) => a.fund.localeCompare(b.fund));

  return {
    funds,
    grand: { ...grand, net: r2(grand.amount - grand.fees) },
    toc: { ...toc, net: r2(toc.amount - toc.fees) },
    txCount: rows.length,
    failed: {
      count: failedCount,
      amount: failedAmount,
      names: [...failedBy.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

// Rows outside the report month mean the Tithe.ly export range was wrong.
export function datesOutsidePeriod(rows: GivingRow[], period: string): number {
  const prefix = period.slice(0, 7); // yyyy-mm
  return rows.filter((r) => !r.tx_date.startsWith(prefix)).length;
}

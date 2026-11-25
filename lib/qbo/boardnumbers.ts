import "server-only";
import { qboQuery, qboReport } from "@/lib/qbo/api";

export type MoneyLine = { label: string; amount: number; lines?: MoneyLine[] };

export type BoardTotals = {
  kind: "board_numbers";
  income: MoneyLine[];
  otherIncome: MoneyLine[];
  expenseSections: MoneyLine[];
  totals: { income: number; expenses: number; net: number };
  balances: { label: string; amount: number; source: "qbo" | "manual" }[];
};

// ---- QBO P&L parsing -------------------------------------------------------
// The Reports API returns nested Rows; we read the top-level groups:
//   Income        -> one line per direct child (subaccounts roll up)
//   Expenses      -> one line per direct child *section or account*
//   Other Income  -> lines
// Net income is computed from the parsed pieces and cross-checked against the
// report's own NetIncome summary when present.

type Col = { value?: string };
type Row = {
  type?: string;
  group?: string;
  ColData?: Col[];
  Header?: { ColData?: Col[] };
  Summary?: { ColData?: Col[] };
  Rows?: { Row?: Row[] };
};

const num = (v: string | undefined): number => {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

// One line per direct child of a section: a Data row is itself a line; a
// nested Section contributes its Summary total.
function childLines(section: Row): MoneyLine[] {
  const out: MoneyLine[] = [];
  for (const child of section.Rows?.Row ?? []) {
    if (child.type === "Data" && child.ColData && child.ColData.length >= 2) {
      const label = child.ColData[0]?.value ?? "";
      if (!label) continue;
      out.push({ label, amount: num(child.ColData[child.ColData.length - 1]?.value) });
    } else if (child.type === "Section") {
      const label =
        child.Header?.ColData?.[0]?.value ??
        child.Summary?.ColData?.[0]?.value?.replace(/^Total for /i, "") ??
        "";
      const amount = num(child.Summary?.ColData?.[child.Summary.ColData.length - 1]?.value);
      if (label) {
        // A section header row can itself carry an amount (e.g. "Marketing
        // $39.59" with a Subscriptions child); the Summary already includes it.
        // Keep the breakdown: the section's own child rows become sub-lines.
        const sub = childLines(child);
        out.push(sub.length ? { label, amount, lines: sub } : { label, amount });
      }
    }
  }
  return out;
}

function findGroup(rows: Row[], group: string): Row | undefined {
  return rows.find((r) => r.group === group);
}

export async function fetchBoardTotals(period: string): Promise<Omit<BoardTotals, "balances" | "kind">> {
  const [y, m] = period.split("-").map(Number);
  const start = `${period.slice(0, 7)}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // last day

  const report = (await qboReport("ProfitAndLoss", {
    start_date: start,
    end_date: end,
    accounting_method: "Accrual",
  })) as { Rows?: { Row?: Row[] } };

  const top = report.Rows?.Row ?? [];
  const incomeSection = findGroup(top, "Income");
  const expensesSection = findGroup(top, "Expenses");
  const otherIncomeSection = findGroup(top, "OtherIncome");

  if (!incomeSection && !expensesSection) {
    throw new Error(
      "Couldn't read the Profit & Loss structure from QuickBooks (no Income/Expenses sections found)."
    );
  }

  const income = incomeSection ? childLines(incomeSection) : [];
  const expenseSections = expensesSection ? childLines(expensesSection) : [];
  const otherIncome = otherIncomeSection ? childLines(otherIncomeSection) : [];

  const incomeTotal = r2(
    income.reduce((s, l) => s + l.amount, 0) +
      otherIncome.reduce((s, l) => s + l.amount, 0)
  );
  const expenseTotal = r2(expenseSections.reduce((s, l) => s + l.amount, 0));
  const net = r2(incomeTotal - expenseTotal);

  // Cross-check against the report's own net income when it reports one.
  const netGroup = findGroup(top, "NetIncome");
  const reported = netGroup?.Summary?.ColData;
  if (reported && reported.length >= 2) {
    const reportedNet = num(reported[reported.length - 1]?.value);
    if (Math.abs(reportedNet - net) > 0.01) {
      throw new Error(
        `Parsed net income (${net}) doesn't match QuickBooks' own total (${reportedNet}). Not generating a wrong board sheet; send Nate's developer this message.`
      );
    }
  }

  return {
    income,
    otherIncome,
    expenseSections,
    totals: { income: incomeTotal, expenses: expenseTotal, net },
  };
}

// Live balances of every active bank account in QBO.
export async function bankBalances(): Promise<MoneyLine[]> {
  const accounts = await qboQuery<{
    FullyQualifiedName: string;
    CurrentBalance?: number;
  }>(
    `select FullyQualifiedName, CurrentBalance from Account where AccountType = 'Bank' and Active = true orderby FullyQualifiedName`
  );
  return accounts.map((a) => ({
    label: a.FullyQualifiedName,
    amount: r2(a.CurrentBalance ?? 0),
  }));
}

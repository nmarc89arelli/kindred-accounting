import "server-only";
import { qboQuery, qboReport } from "@/lib/qbo/api";
import { createAdminClient } from "@/lib/supabase/admin";

// Read-only tools for the Ask feature. There is deliberately no tool that
// creates, updates, or deletes anything, anywhere. A prompt-injected or
// misunderstood question can at worst produce a wrong answer, never a
// changed ledger.

export const TOOL_DEFS = [
  {
    name: "list_transactions",
    description:
      "List bank transactions (purchases/checks and deposits) from QuickBooks in a date range. Optionally filter by category account name substring and/or class name substring. Returns at most 150 rows: date, type, payee, amount, category, class, memo.",
    input_schema: {
      type: "object" as const,
      properties: {
        date_from: { type: "string", description: "yyyy-mm-dd inclusive" },
        date_to: { type: "string", description: "yyyy-mm-dd inclusive" },
        account_contains: {
          type: "string",
          description: "Case-insensitive substring of the category account name, e.g. 'worship'",
        },
        class_contains: {
          type: "string",
          description: "Case-insensitive substring of the class name, e.g. 'legacy'",
        },
        type: { type: "string", enum: ["expense", "deposit", "all"] },
      },
      required: ["date_from", "date_to"],
    },
  },
  {
    name: "profit_and_loss",
    description:
      "QuickBooks Profit & Loss (Statement of Activity) totals by account for a date range. Use for 'how much did we spend/receive on X in period Y' questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        date_from: { type: "string", description: "yyyy-mm-dd" },
        date_to: { type: "string", description: "yyyy-mm-dd" },
      },
      required: ["date_from", "date_to"],
    },
  },
  {
    name: "list_accounts_and_classes",
    description:
      "List the chart of accounts (name + type) and the class list, to find exact names before filtering.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "giving_reports",
    description:
      "Monthly giving report totals generated from Tithe.ly (fund totals, grand total, failed payments) for every month on file. Donor-level detail is not available through this tool.",
    input_schema: { type: "object" as const, properties: {} },
  },
];

type Ref = { value: string; name?: string };
type PLine = {
  Amount?: number;
  Description?: string;
  DetailType: string;
  AccountBasedExpenseLineDetail?: { AccountRef: Ref; ClassRef?: Ref };
};
type Purchase = {
  TxnDate: string;
  TotalAmt: number;
  EntityRef?: Ref;
  PrivateNote?: string;
  DocNumber?: string;
  Line: PLine[];
};
type DLine = {
  Amount?: number;
  Description?: string;
  DetailType: string;
  DepositLineDetail?: { AccountRef?: Ref; ClassRef?: Ref };
};
type Deposit = { TxnDate: string; TotalAmt: number; PrivateNote?: string; Line: DLine[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(s: unknown, label: string): string {
  if (typeof s !== "string" || !DATE_RE.test(s)) {
    throw new Error(`${label} must be yyyy-mm-dd`);
  }
  return s;
}

async function listTransactions(input: Record<string, unknown>) {
  const from = assertDate(input.date_from, "date_from");
  const to = assertDate(input.date_to, "date_to");
  const accountNeedle = String(input.account_contains ?? "").toLowerCase();
  const classNeedle = String(input.class_contains ?? "").toLowerCase();
  const kind = String(input.type ?? "all");

  const rows: {
    date: string;
    type: string;
    payee: string;
    amount: number;
    category: string;
    class: string;
    memo: string;
  }[] = [];

  if (kind !== "deposit") {
    const purchases = await qboQuery<Purchase>(
      `select * from Purchase where TxnDate >= '${from}' and TxnDate <= '${to}' orderby TxnDate desc maxresults 1000`
    );
    for (const p of purchases) {
      for (const l of p.Line) {
        const det = l.AccountBasedExpenseLineDetail;
        if (!det || l.DetailType !== "AccountBasedExpenseLineDetail") continue;
        const account = det.AccountRef.name ?? "";
        const cls = det.ClassRef?.name ?? "";
        if (accountNeedle && !account.toLowerCase().includes(accountNeedle)) continue;
        if (classNeedle && !cls.toLowerCase().includes(classNeedle)) continue;
        rows.push({
          date: p.TxnDate,
          type: "expense",
          payee: p.EntityRef?.name ?? (p.PrivateNote ?? "").slice(0, 40),
          amount: -(l.Amount ?? 0),
          category: account,
          class: cls,
          memo: (l.Description ?? p.PrivateNote ?? "").slice(0, 80),
        });
      }
    }
  }

  if (kind !== "expense") {
    const deposits = await qboQuery<Deposit>(
      `select * from Deposit where TxnDate >= '${from}' and TxnDate <= '${to}' orderby TxnDate desc maxresults 1000`
    );
    for (const d of deposits) {
      for (const l of d.Line) {
        const det = l.DepositLineDetail;
        if (!det || l.DetailType !== "DepositLineDetail") continue;
        const account = det.AccountRef?.name ?? "";
        const cls = det.ClassRef?.name ?? "";
        if (accountNeedle && !account.toLowerCase().includes(accountNeedle)) continue;
        if (classNeedle && !cls.toLowerCase().includes(classNeedle)) continue;
        rows.push({
          date: d.TxnDate,
          type: "deposit",
          payee: (d.PrivateNote ?? "Deposit").slice(0, 40),
          amount: l.Amount ?? 0,
          category: account,
          class: cls,
          memo: (l.Description ?? "").slice(0, 80),
        });
      }
    }
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return {
    row_count: rows.length,
    net_total: Math.round(total * 100) / 100,
    truncated: rows.length > 150,
    rows: rows.slice(0, 150),
  };
}

// Flattens QBO's nested report rows into { account, amount } pairs.
function flattenReport(node: unknown, out: { account: string; amount: number }[]) {
  if (!node || typeof node !== "object") return;
  const n = node as {
    Rows?: { Row?: unknown[] };
    ColData?: { value?: string }[];
    Summary?: { ColData?: { value?: string }[] };
    Header?: { ColData?: { value?: string }[] };
    type?: string;
  };
  if (n.ColData && n.ColData.length >= 2 && n.type === "Data") {
    const name = n.ColData[0]?.value ?? "";
    const amt = Number(n.ColData[n.ColData.length - 1]?.value ?? "");
    if (name && Number.isFinite(amt)) out.push({ account: name, amount: amt });
  }
  if (n.Summary?.ColData && n.Summary.ColData.length >= 2) {
    const name = n.Summary.ColData[0]?.value ?? "";
    const amt = Number(n.Summary.ColData[n.Summary.ColData.length - 1]?.value ?? "");
    if (name && Number.isFinite(amt)) out.push({ account: `TOTAL ${name}`, amount: amt });
  }
  for (const child of n.Rows?.Row ?? []) flattenReport(child, out);
}

async function profitAndLoss(input: Record<string, unknown>) {
  const report = await qboReport("ProfitAndLoss", {
    start_date: assertDate(input.date_from, "date_from"),
    end_date: assertDate(input.date_to, "date_to"),
    accounting_method: "Accrual",
  });
  const lines: { account: string; amount: number }[] = [];
  flattenReport(report, lines);
  return { lines };
}

async function listAccountsAndClasses() {
  const [accounts, cls] = await Promise.all([
    qboQuery<{ FullyQualifiedName: string; AccountType?: string; Classification?: string }>(
      `select FullyQualifiedName, AccountType, Classification from Account where Active = true maxresults 1000`
    ),
    qboQuery<{ Name: string }>(`select Name from Class where Active = true maxresults 200`),
  ]);
  return {
    accounts: accounts.map((a) => ({
      name: a.FullyQualifiedName,
      type: a.AccountType ?? a.Classification ?? "",
    })),
    classes: cls.map((c) => c.Name),
  };
}

async function givingReports() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("reports")
    .select("period, totals, tx_count, generated_at")
    .eq("type", "giving")
    .order("period", { ascending: false });
  return {
    reports: (data ?? []).map((r) => ({
      period: r.period,
      tx_count: r.tx_count,
      totals: r.totals,
    })),
  };
}

export async function runTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "list_transactions":
      return listTransactions(input);
    case "profit_and_loss":
      return profitAndLoss(input);
    case "list_accounts_and_classes":
      return listAccountsAndClasses();
    case "giving_reports":
      return givingReports();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

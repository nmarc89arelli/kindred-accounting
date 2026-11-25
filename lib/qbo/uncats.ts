import "server-only";
import { qboQuery, qboRead, qboUpdate } from "@/lib/qbo/api";

// ---- QBO entity shapes (the slices we use) --------------------------------

type Ref = { value: string; name?: string };

type PurchaseLine = {
  Id?: string;
  Amount: number;
  Description?: string;
  DetailType: string;
  AccountBasedExpenseLineDetail?: { AccountRef: Ref; ClassRef?: Ref };
};

type Purchase = {
  Id: string;
  SyncToken: string;
  TxnDate: string;
  TotalAmt: number;
  PaymentType?: string;
  EntityRef?: Ref;
  AccountRef?: Ref; // bank/credit account
  PrivateNote?: string;
  Line: PurchaseLine[];
};

type DepositLine = {
  Id?: string;
  Amount: number;
  Description?: string;
  DetailType: string;
  DepositLineDetail?: { AccountRef?: Ref; ClassRef?: Ref; Entity?: Ref };
};

type Deposit = {
  Id: string;
  SyncToken: string;
  TxnDate: string;
  TotalAmt: number;
  DepositToAccountRef?: Ref;
  PrivateNote?: string;
  Line: DepositLine[];
};

type Account = {
  Id: string;
  Name: string;
  FullyQualifiedName: string;
  Classification?: string;
  AccountType?: string;
  Active?: boolean;
};

type QboClass = { Id: string; Name: string; Active?: boolean };

// ---- Public shapes --------------------------------------------------------

export type UncatTxn = {
  txnType: "Purchase" | "Deposit";
  id: string;
  date: string;
  amount: number; // positive; direction implied by txnType
  payee: string;
  bankAccount: string;
  memo: string;
  suggestionAccountId?: string;
  suggestionAccountName?: string;
  suggestionCount?: number;
};

export type Option = { id: string; name: string };

const UNCAT_NAMES = [
  "Uncategorized Expense",
  "Uncategorized Income",
  "Uncategorized Asset",
  "Ask My Accountant",
];

async function uncatAccountIds(): Promise<Map<string, string>> {
  const names = UNCAT_NAMES.map((n) => `'${n}'`).join(", ");
  const accounts = await qboQuery<Account>(
    `select Id, Name from Account where Name in (${names})`
  );
  return new Map(accounts.map((a) => [a.Id, a.Name]));
}

function lineIsUncat(l: PurchaseLine, uncats: Map<string, string>): boolean {
  return (
    l.DetailType === "AccountBasedExpenseLineDetail" &&
    !!l.AccountBasedExpenseLineDetail &&
    uncats.has(l.AccountBasedExpenseLineDetail.AccountRef.value)
  );
}

function depositLineIsUncat(l: DepositLine, uncats: Map<string, string>): boolean {
  return (
    l.DetailType === "DepositLineDetail" &&
    !!l.DepositLineDetail?.AccountRef &&
    uncats.has(l.DepositLineDetail.AccountRef.value)
  );
}

const since = (days: number) => {
  const d = new Date(Date.now() - days * 86400_000);
  return d.toISOString().slice(0, 10);
};

// ---- Listing --------------------------------------------------------------

export async function listUncats(): Promise<UncatTxn[]> {
  const uncats = await uncatAccountIds();
  if (uncats.size === 0) return [];

  const [purchases, deposits, suggestions] = await Promise.all([
    qboQuery<Purchase>(
      `select * from Purchase where TxnDate >= '${since(365)}' orderby TxnDate desc maxresults 1000`
    ),
    qboQuery<Deposit>(
      `select * from Deposit where TxnDate >= '${since(365)}' orderby TxnDate desc maxresults 1000`
    ),
    vendorSuggestions(),
  ]);

  const rows: UncatTxn[] = [];

  for (const p of purchases) {
    if (!p.Line.some((l) => lineIsUncat(l, uncats))) continue;
    const payee = p.EntityRef?.name ?? firstWords(p.PrivateNote) ?? "Unknown";
    const s = suggestions.get(normalizePayee(payee));
    rows.push({
      txnType: "Purchase",
      id: p.Id,
      date: p.TxnDate,
      amount: p.TotalAmt,
      payee,
      bankAccount: p.AccountRef?.name ?? "",
      memo: p.PrivateNote ?? "",
      suggestionAccountId: s?.accountId,
      suggestionAccountName: s?.accountName,
      suggestionCount: s?.count,
    });
  }

  for (const d of deposits) {
    if (!d.Line.some((l) => depositLineIsUncat(l, uncats))) continue;
    rows.push({
      txnType: "Deposit",
      id: d.Id,
      date: d.TxnDate,
      amount: d.TotalAmt,
      payee: firstWords(d.PrivateNote) ?? "Deposit",
      bankAccount: d.DepositToAccountRef?.name ?? "",
      memo: d.PrivateNote ?? "",
    });
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows;
}

// Lightweight count for the Home screen (no suggestion queries).
export async function countUncats(): Promise<number> {
  const uncats = await uncatAccountIds();
  if (uncats.size === 0) return 0;
  const [purchases, deposits] = await Promise.all([
    qboQuery<Purchase>(
      `select * from Purchase where TxnDate >= '${since(365)}' orderby TxnDate desc maxresults 1000`
    ),
    qboQuery<Deposit>(
      `select * from Deposit where TxnDate >= '${since(365)}' orderby TxnDate desc maxresults 1000`
    ),
  ]);
  return (
    purchases.filter((p) => p.Line.some((l) => lineIsUncat(l, uncats))).length +
    deposits.filter((d) => d.Line.some((l) => depositLineIsUncat(l, uncats))).length
  );
}

function firstWords(s?: string): string | undefined {
  const t = (s ?? "").trim();
  return t ? t.split(/\s{2,}|\n/)[0].slice(0, 60) : undefined;
}

function normalizePayee(name: string): string {
  return name
    .toLowerCase()
    .replace(/[#*0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

// Vendor history: the most common expense account per payee over the last
// 18 months of already-categorized purchases.
async function vendorSuggestions(): Promise<
  Map<string, { accountId: string; accountName: string; count: number }>
> {
  const uncats = await uncatAccountIds();
  const purchases = await qboQuery<Purchase>(
    `select * from Purchase where TxnDate >= '${since(545)}' orderby TxnDate desc maxresults 1000`
  );

  const tally = new Map<string, Map<string, { name: string; count: number }>>();
  for (const p of purchases) {
    const payee = p.EntityRef?.name ?? firstWords(p.PrivateNote);
    if (!payee) continue;
    const key = normalizePayee(payee);
    for (const l of p.Line) {
      const det = l.AccountBasedExpenseLineDetail;
      if (!det || l.DetailType !== "AccountBasedExpenseLineDetail") continue;
      if (uncats.has(det.AccountRef.value)) continue;
      let byAccount = tally.get(key);
      if (!byAccount) {
        byAccount = new Map();
        tally.set(key, byAccount);
      }
      const cur = byAccount.get(det.AccountRef.value) ?? {
        name: det.AccountRef.name ?? "",
        count: 0,
      };
      cur.count += 1;
      byAccount.set(det.AccountRef.value, cur);
    }
  }

  const out = new Map<string, { accountId: string; accountName: string; count: number }>();
  for (const [key, byAccount] of tally) {
    let best: { accountId: string; accountName: string; count: number } | null = null;
    for (const [accountId, v] of byAccount) {
      if (!best || v.count > best.count) {
        best = { accountId, accountName: v.name, count: v.count };
      }
    }
    if (best && best.count >= 2) out.set(key, best);
  }
  return out;
}

// ---- Options for the pickers ---------------------------------------------

export async function expenseAccounts(): Promise<Option[]> {
  const accounts = await qboQuery<Account>(
    `select Id, FullyQualifiedName, Classification from Account where Active = true and Classification = 'Expense' orderby FullyQualifiedName maxresults 1000`
  );
  return accounts
    .filter((a) => !UNCAT_NAMES.includes(a.Name ?? a.FullyQualifiedName))
    .map((a) => ({ id: a.Id, name: a.FullyQualifiedName }));
}

export async function incomeAccounts(): Promise<Option[]> {
  const accounts = await qboQuery<Account>(
    `select Id, FullyQualifiedName, Classification from Account where Active = true and Classification = 'Revenue' orderby FullyQualifiedName maxresults 1000`
  );
  return accounts.map((a) => ({ id: a.Id, name: a.FullyQualifiedName }));
}

export async function classes(): Promise<Option[]> {
  const cls = await qboQuery<QboClass>(
    `select Id, Name from Class where Active = true orderby Name maxresults 200`
  );
  return cls.map((c) => ({ id: c.Id, name: c.Name }));
}

// ---- Posting --------------------------------------------------------------

// Rewrites the uncategorized line(s) of a transaction to the chosen account
// (and class), leaving every other line untouched. Full update with the
// current SyncToken, per the QBO API contract.
export async function categorize(args: {
  txnType: "Purchase" | "Deposit";
  id: string;
  accountId: string;
  accountName: string;
  classId?: string;
  className?: string;
}): Promise<void> {
  const uncats = await uncatAccountIds();

  if (args.txnType === "Purchase") {
    const p = await qboRead<Purchase>("Purchase", args.id);
    let touched = 0;
    for (const l of p.Line) {
      if (!lineIsUncat(l, uncats)) continue;
      l.AccountBasedExpenseLineDetail!.AccountRef = {
        value: args.accountId,
        name: args.accountName,
      };
      if (args.classId) {
        l.AccountBasedExpenseLineDetail!.ClassRef = {
          value: args.classId,
          name: args.className,
        };
      }
      touched += 1;
    }
    if (touched === 0) throw new Error("Transaction is no longer uncategorized.");
    await qboUpdate("Purchase", p as unknown as Record<string, unknown>);
    return;
  }

  const d = await qboRead<Deposit>("Deposit", args.id);
  let touched = 0;
  for (const l of d.Line) {
    if (!depositLineIsUncat(l, uncats)) continue;
    l.DepositLineDetail!.AccountRef = {
      value: args.accountId,
      name: args.accountName,
    };
    if (args.classId) {
      l.DepositLineDetail!.ClassRef = { value: args.classId, name: args.className };
    }
    touched += 1;
  }
  if (touched === 0) throw new Error("Transaction is no longer uncategorized.");
  await qboUpdate("Deposit", d as unknown as Record<string, unknown>);
}

import "server-only";
import { qboQuery, qboUpdate } from "@/lib/qbo/api";
import type { Option } from "@/lib/qbo/uncats";

type Account = {
  Id: string;
  Name: string;
  FullyQualifiedName: string;
  AccountType?: string;
};

export async function bankAccounts(): Promise<Option[]> {
  const accounts = await qboQuery<Account>(
    `select Id, Name, FullyQualifiedName from Account where AccountType = 'Bank' and Active = true orderby FullyQualifiedName`
  );
  return accounts.map((a) => ({ id: a.Id, name: a.FullyQualifiedName }));
}

// Records a handwritten reimbursement check in QBO as a Purchase with
// PaymentType Check and the physical check number in DocNumber, so the bank
// feed auto-matches when the check clears.
export async function createReimbursementCheck(args: {
  bankAccountId: string;
  bankAccountName: string;
  checkNumber: string;
  amount: number;
  payeeName: string;
  memo: string;
  categoryId: string;
  categoryName: string;
  classId?: string;
  className?: string;
  date: string; // yyyy-mm-dd
}): Promise<string> {
  const body: Record<string, unknown> = {
    PaymentType: "Check",
    DocNumber: args.checkNumber,
    TxnDate: args.date,
    AccountRef: { value: args.bankAccountId, name: args.bankAccountName },
    PrivateNote: `Reimbursement: ${args.payeeName} — ${args.memo}`.slice(0, 990),
    Line: [
      {
        Amount: args.amount,
        DetailType: "AccountBasedExpenseLineDetail",
        Description: `Reimbursement — ${args.payeeName}: ${args.memo}`.slice(0, 990),
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: args.categoryId, name: args.categoryName },
          ...(args.classId
            ? { ClassRef: { value: args.classId, name: args.className } }
            : {}),
        },
      },
    ],
  };

  const created = (await qboUpdate("Purchase", body)) as { Id: string };
  return created.Id;
}

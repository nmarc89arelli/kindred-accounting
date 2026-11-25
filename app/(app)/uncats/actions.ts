"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/roles";
import { categorize } from "@/lib/qbo/uncats";
import { QboDisconnectedError } from "@/lib/qbo/auth";
import { QboApiError } from "@/lib/qbo/api";
import { audit } from "@/lib/audit";

export async function postCategorization(input: {
  txnType: "Purchase" | "Deposit";
  id: string;
  accountId: string;
  accountName: string;
  classId?: string;
  className?: string;
  payee: string;
  amount: number;
  date: string;
}): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "exec")) {
    return { error: "Not authorized" };
  }
  if (!input.accountId || !input.accountName) {
    return { error: "Pick a category first." };
  }

  try {
    await categorize(input);
  } catch (e) {
    if (e instanceof QboDisconnectedError) return { error: e.message };
    if (e instanceof QboApiError) {
      return {
        error: `QuickBooks rejected the update (${e.status}). It may have been changed in QuickBooks since this list loaded; refresh and retry.`,
      };
    }
    return { error: (e as Error).message };
  }

  await audit(session.email, "uncat.categorize", {
    txnType: input.txnType,
    qbo_id: input.id,
    payee: input.payee,
    amount: input.amount,
    date: input.date,
    account: input.accountName,
    class: input.className ?? null,
  });

  revalidatePath("/uncats");
  return {};
}

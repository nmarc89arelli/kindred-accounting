"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createReimbursementCheck } from "@/lib/qbo/checks";
import { QboDisconnectedError } from "@/lib/qbo/auth";
import { QboApiError } from "@/lib/qbo/api";
import { audit } from "@/lib/audit";

async function requireStaff() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "exec")) {
    throw new Error("Not authorized");
  }
  return session;
}

export async function confirmReimbursement(input: {
  id: string;
  checkNumber: string;
  bankAccountId: string;
  bankAccountName: string;
  categoryId: string;
  categoryName: string;
  classId?: string;
  className?: string;
}): Promise<{ error?: string }> {
  const session = await requireStaff();

  const checkNumber = input.checkNumber.trim();
  if (!/^\d{1,8}$/.test(checkNumber)) {
    return { error: "Enter the check number (digits only)." };
  }
  if (!input.categoryId) return { error: "Pick a category." };
  if (!input.bankAccountId) return { error: "Pick the bank account." };

  const admin = createAdminClient();
  const { data: row, error: readError } = await admin
    .from("reimbursements")
    .select("*")
    .eq("id", input.id)
    .single();
  if (readError || !row) return { error: "Submission not found." };
  if (row.status !== "submitted") {
    return { error: "This one has already been confirmed." };
  }

  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  let qboId: string;
  try {
    qboId = await createReimbursementCheck({
      bankAccountId: input.bankAccountId,
      bankAccountName: input.bankAccountName,
      checkNumber,
      amount: Number(row.amount),
      payeeName: row.name,
      memo: row.description,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      classId: input.classId,
      className: input.className,
      date,
    });
  } catch (e) {
    if (e instanceof QboDisconnectedError) return { error: e.message };
    if (e instanceof QboApiError) {
      return { error: `QuickBooks rejected the check (${e.status}).` };
    }
    return { error: (e as Error).message };
  }

  const { error: updateError } = await admin
    .from("reimbursements")
    .update({
      status: "check_written",
      check_number: checkNumber,
      category_name: input.categoryName,
      class_name: input.className ?? null,
      bank_account_name: input.bankAccountName,
      qbo_purchase_id: qboId,
      confirmed_by: session.email,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (updateError) {
    // The check is in QBO; surface the bookkeeping mismatch loudly.
    return {
      error: `Check recorded in QuickBooks (id ${qboId}) but the app couldn't update its own record: ${updateError.message}. Refresh before retrying, or it will be recorded twice.`,
    };
  }

  await audit(session.email, "reimbursement.check_written", {
    source_id: row.source_id,
    payee: row.name,
    amount: row.amount,
    check_number: checkNumber,
    category: input.categoryName,
    class: input.className ?? null,
    qbo_purchase_id: qboId,
  });

  revalidatePath("/reimbursements");
  revalidatePath("/");
  return {};
}

export async function voidReimbursement(
  id: string
): Promise<{ error?: string }> {
  const session = await requireStaff();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reimbursements")
    .update({ status: "void", confirmed_by: session.email, confirmed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "submitted")
    .select("source_id, name, amount")
    .single();
  if (error || !data) return { error: "Couldn't void (already confirmed?)." };
  await audit(session.email, "reimbursement.void", {
    source_id: data.source_id,
    payee: data.name,
    amount: data.amount,
  });
  revalidatePath("/reimbursements");
  return {};
}

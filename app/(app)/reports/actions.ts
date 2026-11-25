"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { newShareToken } from "@/lib/share";
import {
  computeTotals,
  datesOutsidePeriod,
  parseTithelyCsv,
} from "@/lib/tithely";
import { monthLabel } from "@/lib/reports";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

async function requireStaff() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "exec")) {
    throw new Error("Not authorized");
  }
  return session;
}

export async function generateGivingReport(
  formData: FormData
): Promise<{ error?: string; shareUrl?: string }> {
  const session = await requireStaff();

  const month = String(formData.get("month") ?? ""); // yyyy-mm
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Pick the report month." };
  const period = `${month}-01`;

  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Choose the Tithe.ly transactions CSV export." };
  if (file.size > MAX_CSV_BYTES)
    return { error: "That file is larger than a Tithe.ly monthly export should be." };

  const { rows, errors } = parseTithelyCsv(await file.text());
  if (errors.length)
    return { error: `${errors[0]}${errors.length > 1 ? ` (and ${errors.length - 1} more)` : ""}` };
  if (rows.length === 0) return { error: "No transactions found in that file." };

  const stray = datesOutsidePeriod(rows, period);
  if (stray > 0) {
    return {
      error: `${stray} transaction${stray === 1 ? "" : "s"} fall outside ${monthLabel(period)}. Re-export from Tithe.ly with the date range set to exactly that month.`,
    };
  }

  const totals = computeTotals(rows);
  const admin = createAdminClient();

  // Upsert the report for this month; a regenerate keeps the share token.
  const { data: existing } = await admin
    .from("reports")
    .select("id, token_hash")
    .eq("type", "giving")
    .eq("period", period)
    .maybeSingle();

  let reportId: string;
  let shareUrl: string | undefined;

  if (existing) {
    reportId = existing.id;
    const { error } = await admin
      .from("reports")
      .update({
        totals,
        tx_count: rows.length,
        generated_by: session.email,
        generated_at: new Date().toISOString(),
        title: `Giving Report · ${monthLabel(period)}`,
      })
      .eq("id", reportId);
    if (error) return { error: error.message };
    await admin.from("giving_transactions").delete().eq("report_id", reportId);
  } else {
    const { token, hash } = newShareToken();
    const { data, error } = await admin
      .from("reports")
      .insert({
        type: "giving",
        period,
        title: `Giving Report · ${monthLabel(period)}`,
        totals,
        tx_count: rows.length,
        token_hash: hash,
        generated_by: session.email,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    reportId = data.id;
    shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${reportId}?t=${token}`;
  }

  const txRows = rows.map((r) => ({ ...r, report_id: reportId }));
  for (let i = 0; i < txRows.length; i += 500) {
    const { error } = await admin
      .from("giving_transactions")
      .insert(txRows.slice(i, i + 500));
    if (error) return { error: `Transactions failed to store: ${error.message}` };
  }

  await audit(session.email, existing ? "report.regenerate" : "report.generate", {
    type: "giving",
    period,
    tx_count: rows.length,
    grand_total: totals.grand.amount,
  });

  revalidatePath("/reports");
  revalidatePath("/");
  return { shareUrl };
}

export async function rotateShareLink(
  reportId: string
): Promise<{ error?: string; shareUrl?: string }> {
  const session = await requireStaff();
  const admin = createAdminClient();
  const { token, hash } = newShareToken();
  const { data, error } = await admin
    .from("reports")
    .update({ token_hash: hash })
    .eq("id", reportId)
    .select("period")
    .single();
  if (error) return { error: error.message };
  await audit(session.email, "report.link_rotate", { reportId, period: data.period });
  revalidatePath("/reports");
  return {
    shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/share/${reportId}?t=${token}`,
  };
}

export async function revokeShareLink(
  reportId: string
): Promise<{ error?: string }> {
  const session = await requireStaff();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reports")
    .update({ token_hash: null })
    .eq("id", reportId)
    .select("period")
    .single();
  if (error) return { error: error.message };
  await audit(session.email, "report.link_revoke", { reportId, period: data.period });
  revalidatePath("/reports");
  return {};
}

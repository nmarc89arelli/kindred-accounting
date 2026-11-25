import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GivingTotals } from "@/lib/tithely";

export type Report = {
  id: string;
  type: "giving";
  period: string;
  title: string;
  totals: GivingTotals;
  tx_count: number;
  token_hash: string | null;
  generated_by: string;
  generated_at: string;
};

export function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`;
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// Service-role fetch used by the public share route and download routes
// AFTER authorization (token or role) has been established by the caller.
export async function fetchReportById(id: string): Promise<Report | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("reports").select("*").eq("id", id).single();
  return (data as Report) ?? null;
}

export async function fetchReportRows(reportId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("giving_transactions")
    .select("*")
    .eq("report_id", reportId)
    .order("tx_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function logReportView(reportId: string, ip: string, ua: string) {
  const admin = createAdminClient();
  await admin
    .from("report_views")
    .insert({ report_id: reportId, ip, user_agent: ua.slice(0, 300) });
}

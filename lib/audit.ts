import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function audit(
  actorEmail: string,
  action: string,
  detail: Record<string, unknown> = {}
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("audit_log")
    .insert({ actor_email: actorEmail.toLowerCase(), action, detail });
  if (error) {
    // The audit log must never silently fail open on writes that matter;
    // callers run this before reporting success.
    throw new Error(`audit log write failed: ${error.message}`);
  }
}

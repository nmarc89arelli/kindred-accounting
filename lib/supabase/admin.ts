import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service client. Bypasses RLS. Only ever used inside server actions and
// route handlers AFTER the caller's role has been verified.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

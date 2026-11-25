import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "exec" | "board";

export type SessionInfo = {
  email: string;
  name: string;
  role: AppRole;
};

// Returns the signed-in user's app role, or null when the user is not
// signed in or not on the active allowlist. The role comes from a
// SECURITY DEFINER function so RLS on allowed_users stays admin-only.
export async function getSession(): Promise<SessionInfo | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: role } = await supabase.rpc("my_role");
  if (role !== "admin" && role !== "exec" && role !== "board") return null;

  return {
    email: user.email.toLowerCase(),
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      user.email.split("@")[0],
    role,
  };
}

export const TABS: { href: string; label: string; roles: AppRole[] }[] = [
  { href: "/", label: "Home", roles: ["admin", "exec"] },
  { href: "/uncats", label: "Uncats", roles: ["admin", "exec"] },
  { href: "/reimbursements", label: "Reimbursements", roles: ["admin", "exec"] },
  { href: "/reports", label: "Reports", roles: ["admin", "exec", "board"] },
  { href: "/users", label: "Users", roles: ["admin"] },
  { href: "/ask", label: "Ask", roles: ["admin", "exec"] },
  { href: "/settings", label: "Settings", roles: ["admin"] },
];

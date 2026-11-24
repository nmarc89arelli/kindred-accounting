"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["admin", "exec", "board"] as const;

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    throw new Error("Not authorized");
  }
  return session;
}

export async function addUser(formData: FormData): Promise<{ error?: string }> {
  const session = await requireAdmin();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "");

  if (!EMAIL_RE.test(email)) return { error: "That doesn't look like an email address." };
  if (!(ROLES as readonly string[]).includes(role)) return { error: "Pick a role." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("allowed_users")
    .insert({ email, role, added_by: session.email });

  if (error) {
    if (error.code === "23505") return { error: "That email is already on the list." };
    return { error: error.message };
  }

  await audit(session.email, "user.add", { email, role });
  revalidatePath("/users");
  return {};
}

export async function setUserActive(
  id: string,
  active: boolean
): Promise<{ error?: string }> {
  const session = await requireAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("allowed_users")
    .update({ active })
    .eq("id", id)
    .select("email")
    .single();

  if (error) return { error: error.message };
  if (data.email === session.email) {
    // Shouldn't happen (UI hides it), but never let an admin lock themselves out.
    await admin.from("allowed_users").update({ active: true }).eq("id", id);
    return { error: "You can't deactivate yourself." };
  }

  await audit(session.email, active ? "user.reactivate" : "user.deactivate", {
    email: data.email,
  });
  revalidatePath("/users");
  return {};
}

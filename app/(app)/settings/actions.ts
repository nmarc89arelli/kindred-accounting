"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/roles";
import { revokeAndDisconnect } from "@/lib/qbo/auth";
import { audit } from "@/lib/audit";

export async function disconnectQbo(): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Not authorized" };
  await revokeAndDisconnect();
  await audit(session.email, "qbo.disconnect", {});
  revalidatePath("/settings");
  return {};
}

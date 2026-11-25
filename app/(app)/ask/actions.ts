"use server";

import { getSession } from "@/lib/roles";
import { runAsk, type AskResult } from "@/lib/ask/run";
import { audit } from "@/lib/audit";

export async function ask(question: string): Promise<AskResult> {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "exec")) {
    return { answer: "", toolsUsed: [], error: "Not authorized" };
  }
  const q = question.trim();
  if (!q) return { answer: "", toolsUsed: [], error: "Ask something first." };

  const result = await runAsk(q);
  await audit(session.email, "ask.query", {
    question: q.slice(0, 300),
    tools: result.toolsUsed,
    ok: !result.error,
  });
  return result;
}

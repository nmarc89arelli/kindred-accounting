import "server-only";
import { apiBase, getAccess } from "@/lib/qbo/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MINOR_VERSION = "75";

// Logs every failed Intuit call, including intuit_tid, so support questions
// can be answered from our own records.
async function logQboError(args: {
  path: string;
  status: number;
  intuitTid: string | null;
  body: string;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor_email: "system",
      action: "qbo.error",
      detail: {
        path: args.path,
        status: args.status,
        intuit_tid: args.intuitTid,
        body: args.body.slice(0, 2000),
      },
    });
  } catch {
    // Logging must never mask the original failure.
  }
}

export class QboApiError extends Error {
  status: number;
  intuitTid: string | null;
  constructor(message: string, status: number, intuitTid: string | null) {
    super(message);
    this.name = "QboApiError";
    this.status = status;
    this.intuitTid = intuitTid;
  }
}

async function qboFetch(path: string, init?: RequestInit): Promise<unknown> {
  const { accessToken, realmId } = await getAccess();
  const url = `${apiBase()}/v3/company/${realmId}${path}${path.includes("?") ? "&" : "?"}minorversion=${MINOR_VERSION}`;

  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    // Retry only transient throttling/server errors, never writes that
    // might have landed (QBO returns errors before applying in those cases).
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }

  const intuitTid = res!.headers.get("intuit_tid");
  if (!res!.ok) {
    const body = await res!.text();
    await logQboError({ path, status: res!.status, intuitTid, body });
    throw new QboApiError(
      `QuickBooks request failed (${res!.status})`,
      res!.status,
      intuitTid
    );
  }
  return res!.json();
}

export async function qboQuery<T = unknown>(query: string): Promise<T[]> {
  const data = (await qboFetch(`/query?query=${encodeURIComponent(query)}`)) as {
    QueryResponse: Record<string, unknown>;
  };
  const qr = data.QueryResponse ?? {};
  const key = Object.keys(qr).find(
    (k) => Array.isArray((qr as Record<string, unknown>)[k])
  );
  return key ? ((qr as Record<string, unknown>)[key] as T[]) : [];
}

export async function qboRead<T = unknown>(
  entity: string,
  id: string
): Promise<T> {
  const data = (await qboFetch(`/${entity.toLowerCase()}/${id}`)) as Record<string, T>;
  return data[entity] as T;
}

export async function qboUpdate<T = unknown>(
  entity: string,
  body: Record<string, unknown>
): Promise<T> {
  const data = (await qboFetch(`/${entity.toLowerCase()}`, {
    method: "POST",
    body: JSON.stringify(body),
  })) as Record<string, T>;
  return data[entity] as T;
}

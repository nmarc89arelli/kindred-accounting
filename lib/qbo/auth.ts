import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/qbo/crypto";

// --- Discovery -------------------------------------------------------------
// Endpoints come from Intuit's OAuth discovery document (cached 12h), never
// hardcoded, per Intuit's go-live requirements.

type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint: string;
};

let discoveryCache: { at: number; doc: Discovery } | null = null;

export function qboEnv(): "sandbox" | "production" {
  return process.env.INTUIT_ENVIRONMENT === "production" ? "production" : "sandbox";
}

export async function discovery(): Promise<Discovery> {
  if (discoveryCache && Date.now() - discoveryCache.at < 12 * 3600_000) {
    return discoveryCache.doc;
  }
  const url =
    qboEnv() === "production"
      ? "https://developer.api.intuit.com/.well-known/openid_configuration"
      : "https://developer.api.intuit.com/.well-known/openid_sandbox_configuration";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Intuit discovery failed: ${res.status}`);
  const doc = (await res.json()) as Discovery;
  discoveryCache = { at: Date.now(), doc };
  return doc;
}

export function apiBase(): string {
  return qboEnv() === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

function basicAuth(): string {
  return Buffer.from(
    `${process.env.INTUIT_CLIENT_ID}:${process.env.INTUIT_CLIENT_SECRET}`
  ).toString("base64");
}

// --- Connection state ------------------------------------------------------

export type QboStatus =
  | { connected: false }
  | {
      connected: true;
      env: string;
      realmId: string;
      connectedBy: string;
      connectedAt: string;
      refreshExpiresAt: string;
    };

type ConnectionRow = {
  id: number;
  env: string;
  realm_id: string;
  access_token_enc: string;
  refresh_token_enc: string;
  access_expires_at: string;
  refresh_expires_at: string;
  connected_by: string;
  connected_at: string;
};

async function getConnection(): Promise<ConnectionRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("qbo_connection")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return (data as ConnectionRow) ?? null;
}

export async function qboStatus(): Promise<QboStatus> {
  const row = await getConnection();
  if (!row) return { connected: false };
  return {
    connected: true,
    env: row.env,
    realmId: row.realm_id,
    connectedBy: row.connected_by,
    connectedAt: row.connected_at,
    refreshExpiresAt: row.refresh_expires_at,
  };
}

export async function storeTokens(args: {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  connectedBy: string;
}): Promise<void> {
  const admin = createAdminClient();
  const now = Date.now();
  const { error } = await admin.from("qbo_connection").upsert({
    id: 1,
    env: qboEnv(),
    realm_id: args.realmId,
    access_token_enc: encryptToken(args.accessToken),
    refresh_token_enc: encryptToken(args.refreshToken),
    access_expires_at: new Date(now + args.expiresIn * 1000).toISOString(),
    refresh_expires_at: new Date(now + args.refreshExpiresIn * 1000).toISOString(),
    connected_by: args.connectedBy,
    connected_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  });
  if (error) throw new Error(`Failed to store QuickBooks tokens: ${error.message}`);
}

export async function deleteConnection(): Promise<void> {
  const admin = createAdminClient();
  await admin.from("qbo_connection").delete().eq("id", 1);
}

export class QboDisconnectedError extends Error {
  constructor(msg = "QuickBooks is not connected. Reconnect in Settings.") {
    super(msg);
    this.name = "QboDisconnectedError";
  }
}

// Returns a valid access token + realm, refreshing when expired. On an
// expired refresh token or invalid_grant, the stored connection is removed
// so the UI prompts for reconnection.
export async function getAccess(): Promise<{ accessToken: string; realmId: string }> {
  const row = await getConnection();
  if (!row) throw new QboDisconnectedError();

  const expiresAt = new Date(row.access_expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return { accessToken: decryptToken(row.access_token_enc), realmId: row.realm_id };
  }

  if (Date.now() > new Date(row.refresh_expires_at).getTime()) {
    await deleteConnection();
    throw new QboDisconnectedError("QuickBooks session fully expired. Reconnect in Settings.");
  }

  const doc = await discovery();
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(doc.token_endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: decryptToken(row.refresh_token_enc),
      }),
      cache: "no-store",
    });
    if (res.status < 500) break; // retry only transient server errors
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }

  if (!res || !res.ok) {
    if (res && (res.status === 400 || res.status === 401)) {
      // invalid_grant / revoked: require reconnection.
      await deleteConnection();
      throw new QboDisconnectedError();
    }
    throw new Error(`QuickBooks token refresh failed (${res?.status ?? "network"})`);
  }

  const tok = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
  };

  await storeTokens({
    realmId: row.realm_id,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresIn: tok.expires_in,
    refreshExpiresIn: tok.x_refresh_token_expires_in,
    connectedBy: row.connected_by,
  });

  return { accessToken: tok.access_token, realmId: row.realm_id };
}

export async function revokeAndDisconnect(): Promise<void> {
  const row = await getConnection();
  if (!row) return;
  try {
    const doc = await discovery();
    await fetch(doc.revocation_endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ token: decryptToken(row.refresh_token_enc) }),
      cache: "no-store",
    });
  } finally {
    await deleteConnection();
  }
}

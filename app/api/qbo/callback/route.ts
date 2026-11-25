import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/roles";
import { discovery, storeTokens } from "@/lib/qbo/auth";
import { audit } from "@/lib/audit";

function settingsRedirect(param: string) {
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=${param}`
  );
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL!));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const realmId = url.searchParams.get("realmId");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("qbo_oauth_state")?.value;

  if (!code || !realmId) return settingsRedirect("denied");
  if (!state || !expectedState || state !== expectedState) {
    // CSRF check failed: do not exchange the code.
    return settingsRedirect("state_mismatch");
  }

  const doc = await discovery();
  const res = await fetch(doc.token_endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.INTUIT_CLIENT_ID}:${process.env.INTUIT_CLIENT_SECRET}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/qbo/callback`,
    }),
    cache: "no-store",
  });

  if (!res.ok) return settingsRedirect("exchange_failed");

  const tok = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
  };

  await storeTokens({
    realmId,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresIn: tok.expires_in,
    refreshExpiresIn: tok.x_refresh_token_expires_in,
    connectedBy: session.email,
  });
  await audit(session.email, "qbo.connect", { realmId });

  const out = settingsRedirect("connected");
  out.cookies.delete("qbo_oauth_state");
  return out;
}

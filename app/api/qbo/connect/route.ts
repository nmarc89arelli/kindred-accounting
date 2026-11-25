import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/roles";
import { discovery } from "@/lib/qbo/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL!));
  }

  const doc = await discovery();
  const state = randomBytes(16).toString("base64url");

  const url = new URL(doc.authorization_endpoint);
  url.searchParams.set("client_id", process.env.INTUIT_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "com.intuit.quickbooks.accounting");
  url.searchParams.set(
    "redirect_uri",
    `${process.env.NEXT_PUBLIC_APP_URL}/api/qbo/callback`
  );
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  // CSRF: state round-trips through a short-lived, httpOnly cookie.
  res.cookies.set("qbo_oauth_state", state, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/qbo",
  });
  return res;
}

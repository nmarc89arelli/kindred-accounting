import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Allowlist check. my_role() returns null for anyone not active on the
  // list; they get signed out immediately and never see the app.
  const { data: role } = await supabase.rpc("my_role");
  if (role !== "admin" && role !== "exec" && role !== "board") {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/denied`);
  }

  // Record the sign-in (SECURITY DEFINER; updates last_sign_in_at).
  await supabase.rpc("touch_sign_in");

  return NextResponse.redirect(
    role === "board" ? `${origin}/reports` : `${origin}/`
  );
}

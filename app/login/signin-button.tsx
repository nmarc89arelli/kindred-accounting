"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignInButton() {
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }

  return (
    <button className="btn" onClick={signIn} disabled={busy}>
      {busy ? "Redirecting…" : "Sign in with Google"}
    </button>
  );
}

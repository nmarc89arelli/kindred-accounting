import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInButton } from "./signin-button";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="login-shell">
      <div className="login-card">
        <Image
          src="/kindred-logo-green.png"
          alt="Kindred Church"
          width={194}
          height={34}
          priority
        />
        <h1>Accounting</h1>
        <p>Staff and board access only. Sign in with your Google account.</p>
        <SignInButton />
      </div>
    </div>
  );
}

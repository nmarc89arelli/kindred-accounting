import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession, TABS } from "@/lib/roles";
import { Tabs } from "@/components/tabs";
import { SignOutButton } from "@/components/signout-button";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/denied");

  const tabs = TABS.filter((t) => t.roles.includes(session.role));

  return (
    <div className="wrap">
      <header className="app">
        <Image
          src="/kindred-logo-white.png"
          alt="Kindred Church"
          width={171}
          height={30}
          priority
        />
        <span className="whoami">
          Signed in as <b>{session.name}</b> · {roleLabel(session.role)}
        </span>
        <SignOutButton />
      </header>
      <Tabs tabs={tabs} />
      {children}
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "exec") return "Executive Team";
  return "Board";
}

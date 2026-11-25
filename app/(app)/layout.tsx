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
    <div className="shell">
      <aside className="side">
        <Image
          className="logo"
          src="/kindred-logo-white.png"
          unoptimized
          alt="Kindred Church"
          width={171}
          height={30}
          priority
        />
        <Tabs tabs={tabs} />
        <div className="side-foot">
          <b>{session.name}</b>
          <span className="role">{roleLabel(session.role)}</span>
          <SignOutButton />
        </div>
      </aside>
      <div className="content">
        <main>{children}</main>
        <footer>
          Kindred Accounting. Questions or problems: nate@wearekindred.church
        </footer>
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "exec") return "Executive Team";
  return "Board";
}

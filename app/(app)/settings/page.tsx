import { redirect } from "next/navigation";
import { getSession } from "@/lib/roles";
import { qboStatus, qboEnv } from "@/lib/qbo/auth";
import { DisconnectButton } from "./disconnect-button";

export const dynamic = "force-dynamic";

const QBO_MESSAGES: Record<string, { text: string; error: boolean }> = {
  connected: { text: "QuickBooks connected.", error: false },
  denied: { text: "QuickBooks connection was cancelled or denied.", error: true },
  state_mismatch: {
    text: "Security check failed (state mismatch). Start the connection again from this page.",
    error: true,
  },
  exchange_failed: {
    text: "QuickBooks did not accept the authorization. Try connecting again.",
    error: true,
  },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ qbo?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/");

  const { qbo } = await searchParams;
  const flash = qbo ? QBO_MESSAGES[qbo] : undefined;
  const status = await qboStatus();
  const env = qboEnv();

  return (
    <section className="panel">
      <h1>Settings</h1>
      <p className="sub">Connections and configuration. Admin only.</p>

      {flash && (
        <p className={flash.error ? "notice error" : "notice"} style={{ marginBottom: 16 }}>
          {flash.text}
        </p>
      )}

      <h2 className="rpt-h">
        QuickBooks{" "}
        {env === "sandbox" && <span className="pill warn">Sandbox</span>}
      </h2>
      {status.connected ? (
        <div className="notice">
          <span className="pill ok">Connected</span>{" "}
          Company {status.realmId} ({status.env}) · connected by{" "}
          {status.connectedBy} on{" "}
          {new Date(status.connectedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "America/New_York",
          })}
          <br />
          <span className="fine">
            Access renews automatically. Full session expires{" "}
            {new Date(status.refreshExpiresAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "America/New_York",
            })}{" "}
            unless used; any API activity extends it.
          </span>
          <div style={{ marginTop: 12 }}>
            <DisconnectButton />
          </div>
        </div>
      ) : (
        <div className="notice">
          <span className="pill off">Not connected</span> Connect the church
          QuickBooks company to enable Uncats, Reimbursements, and board
          numbers.
          <div style={{ marginTop: 12 }}>
            <a className="btn" href="/api/qbo/connect">
              Connect QuickBooks
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

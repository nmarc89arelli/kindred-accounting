import Image from "next/image";

export default function DeniedPage() {
  return (
    <div className="login-shell">
      <div className="login-card">
        <Image
          src="/kindred-logo-green.png"
          unoptimized
          alt="Kindred Church"
          width={194}
          height={34}
        />
        <h1>No access</h1>
        <p>
          This account isn&apos;t authorized for Kindred Accounting. If you
          think it should be, contact Nate at nate@wearekindred.church.
        </p>
        <a className="btn ghost" href="/login">
          Back to sign in
        </a>
      </div>
    </div>
  );
}

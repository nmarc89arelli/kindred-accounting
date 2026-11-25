"use client";

import { useState, useTransition } from "react";
import { rotateShareLink, revokeShareLink } from "./actions";

export function LinkControls({
  reportId,
  hasLink,
}: {
  reportId: string;
  hasLink: boolean;
}) {
  const [active, setActive] = useState(hasLink);
  const [url, setUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function rotate() {
    startTransition(async () => {
      const r = await rotateShareLink(reportId);
      if (r.shareUrl) {
        setUrl(r.shareUrl);
        setActive(true);
      }
    });
  }

  function revoke() {
    startTransition(async () => {
      await revokeShareLink(reportId);
      setActive(false);
      setUrl(null);
      setConfirming(false);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // URL stays visible for manual copy.
    }
  }

  return (
    <div style={{ maxWidth: 360 }}>
      {active ? (
        <span className="pill ok">Link active</span>
      ) : (
        <span className="pill off">No link</span>
      )}{" "}
      <button className="btn ghost" onClick={rotate} disabled={pending}>
        {active ? "New link" : "Create link"}
      </button>{" "}
      {active &&
        (confirming ? (
          <>
            <button className="btn" onClick={revoke} disabled={pending}>
              Revoke?
            </button>{" "}
            <button className="btn ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn ghost" onClick={() => setConfirming(true)}>
            Revoke
          </button>
        ))}
      {url && (
        <div className="fine" style={{ marginTop: 6 }}>
          Shown once, copy now:{" "}
          <button className="btn ghost" type="button" onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </button>
          <br />
          <code style={{ fontSize: 10, wordBreak: "break-all" }}>{url}</code>
        </div>
      )}
    </div>
  );
}

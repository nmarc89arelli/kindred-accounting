"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectQbo } from "./actions";

export function DisconnectButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function go() {
    startTransition(async () => {
      await disconnectQbo();
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <span>
        <button className="btn" onClick={go} disabled={pending}>
          {pending ? "Disconnecting…" : "Disconnect QuickBooks?"}
        </button>{" "}
        <button className="btn ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button className="btn ghost" onClick={() => setConfirming(true)}>
      Disconnect
    </button>
  );
}

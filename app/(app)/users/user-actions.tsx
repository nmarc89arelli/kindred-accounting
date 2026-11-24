"use client";

import { useState, useTransition } from "react";
import { setUserActive } from "./actions";

export function UserActions({
  id,
  email,
  active,
}: {
  id: string;
  email: string;
  active: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setUserActive(id, !active);
      setConfirming(false);
    });
  }

  if (!active) {
    return (
      <button className="btn ghost" onClick={toggle} disabled={pending}>
        {pending ? "Working…" : "Reactivate"}
      </button>
    );
  }

  if (confirming) {
    return (
      <span style={{ whiteSpace: "nowrap" }}>
        <button className="btn" onClick={toggle} disabled={pending}>
          {pending ? "Working…" : `Deactivate ${email.split("@")[0]}?`}
        </button>{" "}
        <button
          className="btn ghost"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button className="btn ghost" onClick={() => setConfirming(true)}>
      Deactivate
    </button>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { generateBoardNumbers } from "./actions";

function defaultMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function BoardForm({
  manualDefaults,
}: {
  manualDefaults: { label: string; amount: number }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    setShareUrl(null);
    setDone(false);
    startTransition(async () => {
      const result = await generateBoardNumbers(formData);
      if (result.error) setError(result.error);
      else {
        setDone(true);
        setShareUrl(result.shareUrl ?? null);
      }
    });
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // URL stays visible below for manual copy.
    }
  }

  return (
    <>
      <form ref={formRef} action={onSubmit} className="formrow" style={{ alignItems: "center" }}>
        <input
          type="month"
          name="month"
          defaultValue={defaultMonth()}
          aria-label="Report month"
          style={{ font: "inherit", fontSize: 13, border: "1px solid var(--line)", padding: "8px 10px", flex: "0 0 auto", minWidth: 0 }}
          required
        />
        {[1, 2].map((i) => (
          <span key={i} style={{ display: "inline-flex", gap: 6 }}>
            <input
              type="text"
              name={`manual_label_${i}`}
              defaultValue={manualDefaults[i - 1]?.label ?? ""}
              placeholder={`Outside account ${i} (optional)`}
              aria-label={`Manual balance ${i} name`}
              style={{ width: 170, minWidth: 0, flex: "0 0 auto" }}
            />
            <input
              type="text"
              inputMode="decimal"
              name={`manual_amount_${i}`}
              defaultValue={
                manualDefaults[i - 1] ? String(manualDefaults[i - 1].amount) : ""
              }
              placeholder="0.00"
              aria-label={`Manual balance ${i} amount`}
              style={{ width: 110, minWidth: 0, flex: "0 0 auto" }}
            />
          </span>
        ))}
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Generating…" : "Generate board numbers"}
        </button>
      </form>
      <p className="sub" style={{ fontSize: 12, margin: "8px 0 0" }}>
        Income, expense sections, and net pull live from QuickBooks. Bank
        balances pull live too; the optional fields are for accounts QuickBooks
        doesn&apos;t track (they pre-fill from last month).
      </p>
      {error && (
        <p className="notice error" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
      {done && (
        <div className="notice" style={{ marginTop: 10 }}>
          Board numbers generated.{" "}
          {shareUrl ? (
            <>
              Board link (shown once, copy it now):
              <br />
              <code style={{ fontSize: 11, wordBreak: "break-all" }}>{shareUrl}</code>{" "}
              <button className="btn ghost" type="button" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </>
          ) : (
            "The existing board link still works."
          )}
        </div>
      )}
    </>
  );
}

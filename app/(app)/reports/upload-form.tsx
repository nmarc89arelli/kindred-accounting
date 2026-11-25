"use client";

import { useRef, useState, useTransition } from "react";
import { generateGivingReport } from "./actions";

function defaultMonth(): string {
  // Previous month: reports are generated after the month closes.
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function UploadForm() {
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
      const result = await generateGivingReport(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        setShareUrl(result.shareUrl ?? null);
        formRef.current?.reset();
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
      // Selection fallback: the URL is visible in the notice below.
    }
  }

  return (
    <>
      <form ref={formRef} action={onSubmit} className="formrow">
        <input
          type="month"
          name="month"
          defaultValue={defaultMonth()}
          aria-label="Report month"
          style={{ font: "inherit", fontSize: 13, border: "1px solid var(--line)", padding: "8px 10px" }}
          required
        />
        <input type="file" name="csv" accept=".csv,text/csv" aria-label="Tithe.ly CSV export" required />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Generating…" : "Generate report"}
        </button>
      </form>
      <p className="sub" style={{ fontSize: 12, margin: "8px 0 0" }}>
        Tithe.ly → Giving → Transactions → set the date range to the whole
        month → download CSV. Re-uploading a month replaces it and keeps its
        board link.
      </p>
      {error && (
        <p className="notice error" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
      {done && (
        <div className="notice" style={{ marginTop: 10 }}>
          Report generated.{" "}
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

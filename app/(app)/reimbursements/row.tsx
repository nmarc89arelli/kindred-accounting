"use client";

import { useState, useTransition } from "react";
import type { Option } from "@/lib/qbo/uncats";
import { confirmReimbursement, voidReimbursement } from "./actions";

export type Reimbursement = {
  id: string;
  source_id: number;
  name: string;
  email: string;
  phone: string | null;
  description: string;
  amount: number | string;
  receipt_urls: string[];
  submitted_at: string;
  status: "submitted" | "check_written" | "void";
  check_number: string | null;
  category_name: string | null;
  class_name: string | null;
};

export function ReimbursementRow({
  row,
  accounts,
  classOptions,
  banks,
  canConfirm,
}: {
  row: Reimbursement;
  accounts: Option[];
  classOptions: Option[];
  banks: Option[];
  canConfirm: boolean;
}) {
  const [accountId, setAccountId] = useState("");
  const [classId, setClassId] = useState("");
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [checkNo, setCheckNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"open" | "done" | "voided">("open");
  const [voiding, setVoiding] = useState(false);
  const [pending, startTransition] = useTransition();

  const money = Number(row.amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  function confirm() {
    setError(null);
    const account = accounts.find((a) => a.id === accountId);
    const bank = banks.find((b) => b.id === bankId);
    const cls = classOptions.find((c) => c.id === classId);
    if (!account) {
      setError("Pick a category.");
      return;
    }
    if (!bank) {
      setError("Pick the bank account.");
      return;
    }
    startTransition(async () => {
      const result = await confirmReimbursement({
        id: row.id,
        checkNumber: checkNo,
        bankAccountId: bank.id,
        bankAccountName: bank.name,
        categoryId: account.id,
        categoryName: account.name,
        classId: cls?.id,
        className: cls?.name,
      });
      if (result.error) setError(result.error);
      else setState("done");
    });
  }

  function doVoid() {
    startTransition(async () => {
      const result = await voidReimbursement(row.id);
      if (result.error) setError(result.error);
      else setState("voided");
      setVoiding(false);
    });
  }

  if (state !== "open") {
    return (
      <tr style={{ color: "var(--muted)" }}>
        <td>{fmt(row.submitted_at)}</td>
        <td>
          <span style={{ textDecoration: "line-through" }}>{row.name}</span>
        </td>
        <td style={{ textAlign: "right" }}>{money}</td>
        <td colSpan={2}>
          {state === "done"
            ? `${accounts.find((a) => a.id === accountId)?.name ?? ""} · check ${checkNo}`
            : ""}
        </td>
        <td>
          {state === "done" ? (
            <span className="pill ok">Check written · in QBO</span>
          ) : (
            <span className="pill off">Voided</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{fmt(row.submitted_at)}</td>
      <td style={{ maxWidth: 280 }}>
        <span className="desc">{row.name}</span>
        <br />
        <span className="fine">{row.description}</span>
        {row.receipt_urls.length > 0 && (
          <>
            <br />
            <span className="fine">
              {row.receipt_urls.map((u, i) => (
                <a key={u} href={u} target="_blank" rel="noreferrer">
                  Receipt {i + 1}{i < row.receipt_urls.length - 1 ? " · " : ""}
                </a>
              ))}
            </span>
          </>
        )}
      </td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money}</td>
      <td>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          aria-label="Category"
          style={{ maxWidth: 200, marginBottom: 4, display: "block" }}
          disabled={!canConfirm}
        >
          <option value="">Category…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          aria-label="Class"
          style={{ maxWidth: 200, marginBottom: 4, display: "block" }}
          disabled={!canConfirm}
        >
          <option value="">No class</option>
          {classOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={bankId}
          onChange={(e) => setBankId(e.target.value)}
          aria-label="Bank account"
          style={{ maxWidth: 200, display: "block" }}
          disabled={!canConfirm}
        >
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="text"
          inputMode="numeric"
          value={checkNo}
          onChange={(e) => setCheckNo(e.target.value)}
          placeholder="####"
          aria-label="Check number"
          style={{ width: 80 }}
          disabled={!canConfirm}
        />
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <button className="btn" onClick={confirm} disabled={pending || !canConfirm}>
          {pending ? "Recording…" : "Confirm"}
        </button>{" "}
        {voiding ? (
          <>
            <button className="btn" onClick={doVoid} disabled={pending}>
              Void?
            </button>{" "}
            <button className="btn ghost" onClick={() => setVoiding(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn ghost" onClick={() => setVoiding(true)} disabled={pending}>
            Void
          </button>
        )}
        {error && (
          <>
            <br />
            <span className="fine" style={{ color: "var(--danger)" }}>
              {error}
            </span>
          </>
        )}
      </td>
    </tr>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

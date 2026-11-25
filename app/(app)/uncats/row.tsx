"use client";

import { useState, useTransition } from "react";
import type { UncatTxn, Option } from "@/lib/qbo/uncats";
import { Combobox } from "@/components/combobox";
import { postCategorization } from "./actions";

export function UncatRow({
  txn,
  accounts,
  classOptions,
}: {
  txn: UncatTxn;
  accounts: Option[];
  classOptions: Option[];
}) {
  const [accountId, setAccountId] = useState(txn.suggestionAccountId ?? "");
  const [classId, setClassId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [pending, startTransition] = useTransition();

  const money = (txn.txnType === "Deposit" ? "+" : "") +
    txn.amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const showClass = classOptions.length > 0;

  function post() {
    setError(null);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) {
      setError("Pick a category first.");
      return;
    }
    const cls = classOptions.find((c) => c.id === classId);
    startTransition(async () => {
      const result = await postCategorization({
        txnType: txn.txnType,
        id: txn.id,
        accountId: account.id,
        accountName: account.name,
        classId: cls?.id,
        className: cls?.name,
        payee: txn.payee,
        amount: txn.amount,
        date: txn.date,
      });
      if (result.error) setError(result.error);
      else setPosted(true);
    });
  }

  if (posted) {
    return (
      <tr style={{ color: "var(--muted)" }}>
        <td>{fmtDate(txn.date)}</td>
        <td>
          <span style={{ textDecoration: "line-through" }}>{txn.payee}</span>
        </td>
        <td style={{ textAlign: "right" }}>{money}</td>
        <td colSpan={showClass ? 2 : 1}>
          {accounts.find((a) => a.id === accountId)?.name}
        </td>
        <td>
          <span className="pill ok">Posted to QBO</span>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{fmtDate(txn.date)}</td>
      <td>
        <span className="desc">{txn.payee}</span>
        <br />
        <span className="fine">
          {txn.bankAccount}
          {txn.memo && txn.memo !== txn.payee ? ` · ${txn.memo.slice(0, 60)}` : ""}
        </span>
        {txn.suggestionAccountName && (
          <>
            <br />
            <span className="fine" style={{ color: "var(--ok)" }}>
              Suggested: {txn.suggestionAccountName} (used {txn.suggestionCount}
              {txn.suggestionCount === 1 ? " time" : " times"})
            </span>
          </>
        )}
      </td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money}</td>
      <td>
        <Combobox
          options={accounts}
          value={accountId}
          onChange={setAccountId}
          placeholder="Search categories"
          ariaLabel="Category"
        />
      </td>
      {showClass && (
        <td>
          <Combobox
            options={classOptions}
            value={classId}
            onChange={setClassId}
            placeholder="None"
            ariaLabel="Class"
            allowNone
          />
        </td>
      )}
      <td>
        <button className="btn" onClick={post} disabled={pending}>
          {pending ? "Posting…" : "Post"}
        </button>
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

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

"use client";

import { useState } from "react";
import type { BoardTotals, MoneyLine } from "@/lib/qbo/boardnumbers";
import { money, monthLabel } from "@/lib/reports-shared";

export function BoardNumbers({
  period,
  totals,
  generatedAt,
  prior,
  priorPeriod,
}: {
  period: string;
  totals: BoardTotals;
  generatedAt: string;
  prior?: BoardTotals | null;
  priorPeriod?: string;
}) {
  const [compare, setCompare] = useState(false);
  const showPrior = compare && !!prior;

  const priorMap = new Map<string, number>();
  if (prior) {
    for (const l of [...prior.income, ...prior.otherIncome, ...prior.expenseSections]) {
      priorMap.set(l.label, l.amount);
    }
  }

  const section = (title: string, lines: MoneyLine[]) =>
    lines.length === 0 ? null : (
      <>
        <tr>
          <th
            colSpan={showPrior ? 3 : 2}
            style={{ textAlign: "left", paddingTop: 14 }}
          >
            {title}
          </th>
        </tr>
        {lines.map((l) => (
          <tr key={`${title}-${l.label}`}>
            <td>{l.label}</td>
            <td style={{ textAlign: "right" }}>{money(l.amount)}</td>
            {showPrior && (
              <td style={{ textAlign: "right", color: "var(--muted)" }}>
                {priorMap.has(l.label) ? money(priorMap.get(l.label)!) : "—"}
              </td>
            )}
          </tr>
        ))}
      </>
    );

  const totalRow = (label: string, cur: number, prev?: number) => (
    <tr style={{ fontWeight: 700 }}>
      <td>{label}</td>
      <td style={{ textAlign: "right" }}>{money(cur)}</td>
      {showPrior && (
        <td style={{ textAlign: "right", color: "var(--muted)" }}>
          {prev !== undefined ? money(prev) : "—"}
        </td>
      )}
    </tr>
  );

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--display)",
          fontSize: 26,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 400,
          margin: "0 0 2px",
        }}
      >
        Board Numbers · {monthLabel(period)}
      </h1>
      <p className="sub" style={{ marginBottom: 12 }}>
        Source: QuickBooks Statement of Activity · Generated{" "}
        {new Date(generatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "America/New_York",
        })}{" "}
        · View only
      </p>
      {prior && (
        <p style={{ margin: "0 0 14px" }}>
          <button className="btn ghost" onClick={() => setCompare(!compare)}>
            {compare
              ? "Hide comparison"
              : `Compare to ${monthLabel(priorPeriod!)}`}
          </button>
        </p>
      )}
      <div className="tscroll">
        <table style={{ minWidth: 420, maxWidth: 640 }}>
          <thead>
            <tr>
              <th></th>
              <th style={{ textAlign: "right" }}>{monthLabel(period)}</th>
              {showPrior && (
                <th style={{ textAlign: "right" }}>{monthLabel(priorPeriod!)}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {section("Income", [...totals.income, ...totals.otherIncome])}
            {totalRow("Total income", totals.totals.income, prior?.totals.income)}
            {section("Expenses", totals.expenseSections)}
            {totalRow("Total expenses", totals.totals.expenses, prior?.totals.expenses)}
            {totalRow("Net income", totals.totals.net, prior?.totals.net)}
            {section(
              "Account balances (as of generation)",
              totals.balances.map((b) => ({
                label: b.source === "manual" ? `${b.label} (reported)` : b.label,
                amount: b.amount,
              }))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

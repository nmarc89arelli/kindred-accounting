"use client";

import { useState, type ReactNode } from "react";
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
  const addPrior = (lines: MoneyLine[], prefix: string) => {
    for (const l of lines) {
      priorMap.set(prefix + l.label, l.amount);
      if (l.lines) addPrior(l.lines, `${prefix}${l.label} > `);
    }
  };
  if (prior) {
    addPrior([...prior.income, ...prior.otherIncome], "Income|");
    addPrior(prior.expenseSections, "Expenses|");
  }

  const rows = (
    lines: MoneyLine[],
    depth: number,
    prefix: string
  ): ReactNode[] =>
    lines.flatMap((l) => {
      const key = prefix + l.label;
      const row = (
        <tr key={key}>
          <td
            style={{
              paddingLeft: depth * 18,
              fontWeight: l.lines ? 600 : 400,
            }}
          >
            {l.label}
          </td>
          <td style={{ textAlign: "right", fontWeight: l.lines ? 600 : 400 }}>
            {money(l.amount)}
          </td>
          {showPrior && (
            <td style={{ textAlign: "right", color: "var(--muted)" }}>
              {priorMap.has(key) ? money(priorMap.get(key)!) : "—"}
            </td>
          )}
        </tr>
      );
      return l.lines ? [row, ...rows(l.lines, depth + 1, `${key} > `)] : [row];
    });

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
        {rows(lines, 0, `${title}|`)}
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

import type { GivingTotals } from "@/lib/tithely";
import { money, monthLabel } from "@/lib/reports";

// Board rendition: aggregates only, never donor names.
export function BoardReport({
  period,
  totals,
  generatedAt,
  txCount,
}: {
  period: string;
  totals: GivingTotals;
  generatedAt: string;
  txCount: number;
}) {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--display)", fontSize: 26, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 400, margin: "0 0 2px" }}>
        Giving Report · {monthLabel(period)}
      </h1>
      <p className="sub" style={{ marginBottom: 16 }}>
        Source: Tithe.ly · Generated {new Date(generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })} · View only · Overview, no donor detail
      </p>
      <div className="tscroll">
        <table style={{ minWidth: 480, maxWidth: 640 }}>
          <thead>
            <tr>
              <th>Fund</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "right" }}>Fees</th>
              <th style={{ textAlign: "right" }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {totals.funds.map((f) => (
              <tr key={f.fund}>
                <td>{f.fund}</td>
                <td style={{ textAlign: "right" }}>{money(f.amount)}</td>
                <td style={{ textAlign: "right" }}>{money(f.fees)}</td>
                <td style={{ textAlign: "right" }}>{money(f.net)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td>Grand Total</td>
              <td style={{ textAlign: "right" }}>{money(totals.grand.amount)}</td>
              <td style={{ textAlign: "right" }}>{money(totals.grand.fees)}</td>
              <td style={{ textAlign: "right" }}>{money(totals.grand.net)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="sub" style={{ marginTop: 14 }}>
        Tithes, Offerings &amp; Charity Giving: <b>{money(totals.toc.amount)}</b>{" "}
        · {txCount} transactions · Failed payments: {totals.failed.count} totaling{" "}
        {money(totals.failed.amount)}
      </p>
    </div>
  );
}

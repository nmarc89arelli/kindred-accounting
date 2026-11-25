"use client";

import { useState, useTransition } from "react";
import { ask } from "./actions";

type Entry = { q: string; a?: string; error?: string };

const CHIPS = [
  "List all transactions in Worship for last month",
  "How much have we spent on Kids this year?",
  "What did giving look like the last 3 months?",
];

export function AskClient() {
  const [input, setInput] = useState("");
  const [thread, setThread] = useState<Entry[]>([]);
  const [pending, startTransition] = useTransition();

  function submit(q: string) {
    const question = q.trim();
    if (!question || pending) return;
    setInput("");
    setThread((t) => [{ q: question }, ...t]);
    startTransition(async () => {
      const result = await ask(question);
      setThread((t) =>
        t.map((e, i) =>
          i === 0 ? { ...e, a: result.answer, error: result.error } : e
        )
      );
    });
  }

  return (
    <>
      <form
        className="formrow"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="List all transactions in Worship for last month"
          aria-label="Ask a question about the books"
        />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Looking…" : "Ask"}
        </button>
      </form>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            className="btn ghost"
            style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}
            onClick={() => submit(c)}
            disabled={pending}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        {thread.map((e, i) => (
          <div key={`${i}-${e.q}`}>
            <p
              style={{
                fontWeight: 700,
                borderLeft: "3px solid var(--green)",
                paddingLeft: 12,
                margin: "0 0 8px",
              }}
            >
              {e.q}
            </p>
            <div
              style={{
                border: "1px solid var(--line)",
                padding: 16,
                whiteSpace: "pre-wrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {e.error ? (
                <span style={{ color: "var(--danger)" }}>{e.error}</span>
              ) : e.a !== undefined ? (
                e.a
              ) : (
                <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
                  Querying the books…
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

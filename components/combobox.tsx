"use client";

import { useEffect, useRef, useState } from "react";

export type ComboOption = { id: string; name: string };

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  allowNone,
}: {
  options: ComboOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  ariaLabel: string;
  allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.name.toLowerCase().includes(q))
    : options;

  function openPop() {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const up = r.bottom + 272 > window.innerHeight && r.top > 280;
    setPos({
      top: up ? r.top : r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 260),
      up,
    });
    setQuery("");
    setActive(0);
    setOpen(true);
  }

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    inputRef.current?.blur();
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !inputRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    function onAway() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onAway);
    window.addEventListener("scroll", onAway, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onAway);
      window.removeEventListener("scroll", onAway, true);
    };
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      openPop();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="cbx">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        placeholder={selected ? selected.name : placeholder}
        className={selected && !open ? "cbx-filled" : ""}
        value={open ? query : selected?.name ?? ""}
        onFocus={openPop}
        onClick={() => !open && openPop()}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          if (!open) openPop();
        }}
        onKeyDown={onKey}
      />
      <span className="cbx-caret" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="12" height="12">
          <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {open && pos && (
        <div
          ref={popRef}
          className="cbx-pop"
          style={{
            top: pos.up ? undefined : pos.top,
            bottom: pos.up ? window.innerHeight - pos.top + 4 : undefined,
            left: pos.left,
            width: pos.width,
          }}
          role="listbox"
        >
          {allowNone && (
            <button
              type="button"
              className={`cbx-opt${value === "" ? " sel" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick("")}
            >
              None
            </button>
          )}
          {filtered.length === 0 && (
            <div className="cbx-none">No match for &ldquo;{query}&rdquo;</div>
          )}
          {filtered.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              className={`cbx-opt${i === active ? " act" : ""}${o.id === value ? " sel" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o.id)}
            >
              {o.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

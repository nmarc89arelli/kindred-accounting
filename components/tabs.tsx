"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  "/": (
    <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
  ),
  "/uncats": <path d="M4 6h16M4 12h16M4 18h10" />,
  "/reimbursements": <path d="M5 13l4 4L19 7" />,
  "/reports": <path d="M4 20V9m6 11V4m6 16v-7" />,
  "/users": (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 4c1.5 0 3 1.5 3 3.5S17.5 11 16 11" />
    </>
  ),
  "/ask": (
    <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2.5L22.5 18 20 19l-1 2.5L18 19l-2.5-1 2.5-.5z" />
  ),
  "/settings": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
};

export function Tabs({
  tabs,
}: {
  tabs: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="snav">
      {tabs.map((t) => {
        const active =
          t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
          >
            {ICONS[t.href] && (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {ICONS[t.href]}
              </svg>
            )}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

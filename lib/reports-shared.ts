// Shared between server and client components: no server-only imports here.

export function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`;
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

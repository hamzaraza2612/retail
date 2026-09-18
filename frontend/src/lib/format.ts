export function formatMoney(value: number | undefined | null): string {
  const n = value ?? 0;
  return "Rs. " + n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function toInputDate(value?: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

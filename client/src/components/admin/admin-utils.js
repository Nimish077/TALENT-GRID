export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export const inputClass =
  "h-10 rounded-[var(--radius)] border border-border bg-surface px-3 text-sm focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-brand";

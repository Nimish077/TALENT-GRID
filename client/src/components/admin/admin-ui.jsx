import Button from "../ui/button.jsx";
import { Badge } from "../dashboard/primitives.jsx";
import { capitalize } from "../../lib/format.js";

const statusStyle = {
  active: "bg-accent-muted text-accent-dark",
  pending: "bg-warning-light text-warning",
  suspended: "bg-error-light text-error",
};

export function StatusBadge({ status }) {
  return <Badge className={statusStyle[status] ?? "bg-surface-muted text-text-secondary"}>{capitalize(status)}</Badge>;
}

export function Pager({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-text-secondary">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
      <span>Page {page} of {pages}</span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
    </nav>
  );
}

export function InlineError({ error, onRetry }) {
  return (
    <div role="alert" className="rounded-xl border border-error/30 bg-error-light p-4 text-sm">
      <p className="text-text-primary">{error.message || "Something went wrong."}</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-2 font-medium text-brand hover:text-brand-dark">Try again</button>}
    </div>
  );
}

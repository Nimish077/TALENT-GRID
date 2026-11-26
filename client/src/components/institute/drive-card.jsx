import { Badge, Card } from "../dashboard/primitives.jsx";
import Button from "../ui/button.jsx";
import { capitalize } from "../../lib/format.js";

const statusStyle = {
  draft: "bg-surface-muted text-text-secondary",
  open: "bg-accent-muted text-accent-dark",
  closed: "bg-warning-light text-warning",
  completed: "bg-brand-light text-brand",
  cancelled: "bg-error-light text-error",
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

function driveAction(status) {
  if (status === "draft" || status === "closed") return "open";
  if (status === "open") return "close";
  return null;
}

export default function DriveCard({ drive, canManage, busy, onAction }) {
  const action = canManage ? driveAction(drive.status) : null;
  const opens = formatDate(drive.application_open_at);
  const deadline = formatDate(drive.application_deadline);
  const applicants = drive._count?.candidates ?? 0;
  const chips = [
    drive.min_cgpa != null && drive.min_cgpa !== "" && `Min CGPA ${Number(drive.min_cgpa)}`,
    drive.max_backlogs != null && `Max backlogs ${drive.max_backlogs}`,
    drive.eligible_batch && `Batch ${drive.eligible_batch}`,
  ].filter(Boolean);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{drive.title}</h2>
          <Badge className={statusStyle[drive.status] ?? statusStyle.draft}>{capitalize(drive.status)}</Badge>
        </div>
        {action && (
          <Button size="sm" variant={action === "close" ? "outline" : "primary"} disabled={busy} onClick={() => onAction(drive, action)}>
            {action === "open" ? (drive.status === "closed" ? "Reopen drive" : "Open drive") : "Close drive"}
          </Button>
        )}
      </div>
      {drive.description && <p className="mt-2 text-[13px] text-text-secondary">{drive.description}</p>}
      {chips.length > 0 && (
        <ul aria-label="Eligibility" className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-text-secondary">{c}</li>
          ))}
        </ul>
      )}
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
        <div>
          <dt className="text-xs text-text-muted">Application window</dt>
          <dd>{opens || deadline ? `${opens ?? "—"} → ${deadline ?? "—"}` : "Not scheduled"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Applicants</dt>
          <dd>{applicants}</dd>
        </div>
      </dl>
    </Card>
  );
}

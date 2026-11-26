import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Card, EmptyState, PageState } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import { applicationsApi, jobsApi } from "../../lib/endpoints.js";
import { applicationStatusStyle, capitalize, initials } from "../../lib/format.js";
import { useResource } from "../../lib/use-resource.js";

// Mirrors the API's transition matrix (anything else is a 409).
const ACTIONS = {
  applied: [["shortlisted", "Shortlist"], ["rejected", "Reject"]],
  shortlisted: [["selected", "Select"], ["rejected", "Reject"]],
};

function ApplicantsPage() {
  const { jobId } = useParams();
  const { data, error, loading, reload } = useResource(() => jobsApi.applications(jobId));
  const [pendingId, setPendingId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function move(applicationId, status) {
    setPendingId(applicationId);
    setActionError("");
    try {
      await applicationsApi.setStatus(applicationId, status);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  const applications = data?.applications ?? [];

  return (
    <AppShell back={{ to: "/employer/jobs", label: "Your jobs" }} title="Applicants" subtitle="Review candidates and move them through your pipeline.">
      {actionError && <p role="alert" className="mb-4 text-sm text-error">{actionError}</p>}
      <PageState loading={loading} error={error} onRetry={reload}>
        <Card className="px-5">
          {applications.length === 0 ? (
            <EmptyState>No applicants yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {applications.map((app) => {
                const name = app.candidate_profile?.user?.full_name ?? "Candidate";
                return (
                  <li key={app.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">{initials(name)}</span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2">
                          <Link to={`/employer/talent/${app.candidate_profile_id}`} className="truncate font-medium hover:text-brand">{name}</Link>
                          {app.source === "invited" && <Badge className="bg-brand-light font-normal text-brand">Invited</Badge>}
                        </p>
                        <p className="truncate text-xs text-text-muted">
                          {[app.candidate_profile?.headline, app.applied_at && `Applied ${new Date(app.applied_at).toLocaleDateString()}`].filter(Boolean).join(" · ")}
                        </p>
                        {app.cover_note && <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{app.cover_note}</p>}
                        <Link to={`/employer/talent/${app.candidate_profile_id}`} className="mt-1 inline-block text-xs font-medium text-brand hover:text-brand-dark">View profile &amp; assessment evidence →</Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={applicationStatusStyle[app.status] ?? "bg-surface-muted"}>{capitalize(app.status)}</Badge>
                      {(ACTIONS[app.status] ?? []).map(([status, label]) => (
                        <Button key={status} size="sm" variant={status === "rejected" ? "outline" : "primary"} disabled={pendingId === app.id} onClick={() => move(app.id, status)}>
                          {label}
                        </Button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </PageState>
    </AppShell>
  );
}

export default ApplicantsPage;

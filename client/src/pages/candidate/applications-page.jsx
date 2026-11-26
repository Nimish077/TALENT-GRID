import { useState } from "react";
import { Badge, Card, EmptyState, PageState } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import { applicationsApi } from "../../lib/endpoints.js";
import { applicationStatusStyle, capitalize } from "../../lib/format.js";
import { useResource } from "../../lib/use-resource.js";

const WITHDRAWABLE = new Set(["applied", "shortlisted"]);

function ApplicationsPage() {
  const { data, error, loading, reload } = useResource(() => applicationsApi.mine());
  const [pendingId, setPendingId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function withdraw(id) {
    setPendingId(id);
    setActionError("");
    try {
      await applicationsApi.withdraw(id);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  const applications = data?.applications ?? [];

  return (
    <AppShell title="My Applications" subtitle="Track every role you've applied to.">
      {actionError && <p role="alert" className="mb-4 text-sm text-error">{actionError}</p>}
      <PageState loading={loading} error={error} onRetry={reload}>
        <Card className="px-5">
          {applications.length === 0 ? (
            <EmptyState>You haven&apos;t applied to any jobs yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {applications.map((app) => (
                <li key={app.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {app.job?.title}
                      {app.source === "invited" && <Badge className="bg-brand-light font-normal text-brand">Invited by employer</Badge>}
                    </p>
                    <p className="text-xs text-text-muted">
                      {[app.job?.organization?.name, app.applied_at && `Applied ${new Date(app.applied_at).toLocaleDateString()}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={applicationStatusStyle[app.status] ?? "bg-surface-muted text-text-secondary"}>{capitalize(app.status)}</Badge>
                    {WITHDRAWABLE.has(app.status) && (
                      <Button size="sm" variant="outline" disabled={pendingId === app.id} onClick={() => withdraw(app.id)}>
                        {pendingId === app.id ? "Withdrawing…" : "Withdraw"}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageState>
    </AppShell>
  );
}

export default ApplicationsPage;

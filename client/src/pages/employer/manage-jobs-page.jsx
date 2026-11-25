import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, EmptyState, PageState, PendingNotice } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import { organizationsApi, jobsApi } from "../../lib/endpoints.js";
import { capitalize } from "../../lib/format.js";
import { loadEmployerOrganization } from "../../lib/organization.js";
import { useResource } from "../../lib/use-resource.js";

const statusStyle = {
  draft: "bg-surface-muted text-text-secondary",
  published: "bg-accent-muted text-accent-dark",
  closed: "bg-error-light text-error",
};

async function loadJobs() {
  const org = await loadEmployerOrganization();
  if (!org.canManage) return { ...org, jobs: [] };
  const { jobs } = await organizationsApi.jobs(org.organization.id);
  return { ...org, jobs };
}

function ManageJobsPage() {
  const { data, error, loading, reload } = useResource(loadJobs);
  const [pendingId, setPendingId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function run(jobId, action) {
    setPendingId(jobId);
    setActionError("");
    try {
      await action(jobId);
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <AppShell
      title="Your Jobs"
      subtitle={data?.organization?.name}
      action={data?.canManage && <Button to="/employer/jobs/new">+ Post a Job</Button>}
    >
      {actionError && <p role="alert" className="mb-4 text-sm text-error">{actionError}</p>}
      <PageState loading={loading} error={error} onRetry={reload}>
        {data?.pending && <PendingNotice kind="organization" suspended={data.suspended} />}
        {data?.canManage && (
          <Card className="px-5">
            {data.jobs.length === 0 ? (
              <EmptyState>You haven&apos;t posted any jobs yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {data.jobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="font-medium">{job.title}</p>
                      <p className="text-xs text-text-muted">
                        {[job.location, job.employment_type && capitalize(job.employment_type)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className={statusStyle[job.status] ?? statusStyle.draft}>{capitalize(job.status)}</Badge>
                      <Link to={`/employer/jobs/${job.id}/applicants`} className="text-sm font-medium text-brand hover:text-brand-dark">
                        {job._count?.applications ?? 0} applicants
                      </Link>
                      {job.status === "draft" && (
                        <Button size="sm" disabled={pendingId === job.id} onClick={() => run(job.id, jobsApi.publish)}>Publish</Button>
                      )}
                      {job.status === "published" && (
                        <Button size="sm" variant="outline" disabled={pendingId === job.id} onClick={() => run(job.id, jobsApi.close)}>Close</Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </PageState>
    </AppShell>
  );
}

export default ManageJobsPage;

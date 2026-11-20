import { Badge, Card, CardHeader, EmptyState, PageState, PendingNotice, ProgressBar, StatCard } from "../../components/dashboard/primitives.jsx";
import Button from "../../components/ui/button.jsx";
import { jobsApi, organizationsApi } from "../../lib/endpoints.js";
import { applicationStatusStyle, capitalize, initials } from "../../lib/format.js";
import { pipelineStages } from "../../lib/dashboard-data.js";
import { useResource } from "../../lib/use-resource.js";

const isActive = (status) => status === "active";

async function loadEmployerDashboard() {
  const { memberships } = await organizationsApi.mine();
  const membership = memberships.find((m) => isActive(m.status)) ?? memberships[0];
  if (!membership) return { organization: null, jobs: [], applications: [], pending: false };

  const { organization } = membership;
  if (!isActive(membership.status) || !isActive(organization.status)) {
    return { organization, jobs: [], applications: [], pending: true };
  }

  const { jobs } = await organizationsApi.jobs(organization.id);
  const withApplicants = jobs.filter((job) => job._count.applications > 0);
  const lists = await Promise.all(withApplicants.map((job) => jobsApi.applications(job.id)));
  const applications = lists.flatMap((list, index) =>
    list.applications.map((application) => ({ ...application, job: withApplicants[index] })),
  );
  return { organization, jobs, applications, pending: false };
}

const icons = {
  briefcase: <path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Zm6 0V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M3 13h18" />,
  people: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 9c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.2.7 3.5 2.6 3.5 5.6" />,
  trend: <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />,
  check: <path d="m5 12 5 5 9-10" />,
};

function Icon({ name }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function EmployerContent({ data }) {
  const { organization, jobs, applications, pending } = data;
  const activeJobs = jobs.filter((job) => job.status === "published");
  const stages = pipelineStages(applications);
  const total = stages[0].value;
  const recent = [...applications].sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at)).slice(0, 4);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] tracking-[-0.03em]">Hiring Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">{organization ? `${organization.name} · Overview` : "Overview"}</p>
        </div>
        <Button size="md" disabled title="Job posting is coming soon">+ Post a Job</Button>
      </div>

      {pending && <PendingNotice kind="organization" />}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Icon name="briefcase" />} label="Active Jobs" value={activeJobs.length} tone="text-brand" />
        <StatCard icon={<Icon name="people" />} iconTone="bg-surface-muted text-text-secondary" label="Total Applicants" value={total} />
        <StatCard icon={<Icon name="trend" />} iconTone="bg-purple-100 text-purple-700" label="Shortlisted" value={stages[1].value} tone="text-purple-700" />
        <StatCard icon={<Icon name="check" />} iconTone="bg-accent-muted text-accent-dark" label="Selected" value={stages[2].value} tone="text-accent-dark" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_352px]">
        <div className="space-y-5">
          <Card className="p-5">
            <CardHeader title="Hiring Pipeline" />
            <ul className="mt-5 space-y-3">
              {stages.map((stage) => {
                const percent = total ? Math.round((stage.value / total) * 100) : 0;
                return (
                  <li key={stage.label} className="grid grid-cols-[110px_1fr_44px] items-center gap-4 text-sm">
                    <span className="text-text-secondary">{stage.label}</span>
                    <ProgressBar percent={percent} color={stage.color} label={`${stage.label} share`} />
                    <span className="text-right text-xs text-text-muted">
                      <span className="sr-only">{stage.value} applicants, </span>{percent}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-5">
            <CardHeader title="Active Jobs" />
            {activeJobs.length === 0 ? (
              <EmptyState>No published jobs yet.</EmptyState>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {activeJobs.map((job) => (
                  <li key={job.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{job.title}</p>
                      <p className="text-sm text-text-muted">
                        {[job.location && (job.work_mode ? `${job.location} (${capitalize(job.work_mode)})` : job.location), capitalize(job.employment_type)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{job._count.applications}</p>
                      <p className="text-xs text-text-muted">applicants</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit p-5">
          <CardHeader title="Recent Applicants" />
          {recent.length === 0 ? (
            <EmptyState>No applicants yet.</EmptyState>
          ) : (
            <ul className="mt-5 space-y-5">
              {recent.map((app) => {
                const name = app.candidate_profile.user.full_name;
                return (
                  <li key={app.id} className="flex items-start gap-3">
                    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">{initials(name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{name}</p>
                      <p className="truncate text-xs text-text-muted">{app.candidate_profile.headline || app.job.title}</p>
                    </div>
                    <Badge className={applicationStatusStyle[app.status] ?? "bg-surface-muted"}>{capitalize(app.status)}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function EmployerDashboard() {
  const { data, error, loading, reload } = useResource(loadEmployerDashboard);
  return (
    <main className="mx-auto max-w-[1096px] px-5 pb-16 pt-8 sm:px-8">
      <PageState loading={loading} error={error} onRetry={reload}>
        {data && <EmployerContent data={data} />}
      </PageState>
    </main>
  );
}

export default EmployerDashboard;

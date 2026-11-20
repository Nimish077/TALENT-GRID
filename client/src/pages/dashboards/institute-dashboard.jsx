import { Badge, Card, CardHeader, EmptyState, PageState, PendingNotice, ProgressBar, StatCard } from "../../components/dashboard/primitives.jsx";
import { institutionsApi } from "../../lib/endpoints.js";
import { capitalize } from "../../lib/format.js";
import { useResource } from "../../lib/use-resource.js";

const isActive = (status) => status === "active";

async function loadInstituteDashboard() {
  const { memberships } = await institutionsApi.mine();
  const membership = memberships.find((m) => isActive(m.status)) ?? memberships[0];
  if (!membership) return { institution: null, pending: false };

  const { institution } = membership;
  if (!isActive(membership.status) || !isActive(institution.status)) return { institution, pending: true };

  const id = institution.id;
  const total = (params) => institutionsApi.memberships(id, { limit: 1, ...params }).then((r) => r.pagination.total);
  const [students, verified, pendingVerification, rejected, recent, drives] = await Promise.all([
    total(),
    total({ verification_status: "verified" }),
    total({ verification_status: "pending" }),
    total({ verification_status: "rejected" }),
    institutionsApi.memberships(id, { limit: 5 }),
    institutionsApi.drives(id),
  ]);
  return {
    institution,
    pending: false,
    students,
    verified,
    pendingVerification,
    rejected,
    unverified: Math.max(0, students - verified - pendingVerification - rejected),
    recent: recent.items,
    drives: drives.drives,
  };
}

const icons = {
  people: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 9c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.2.7 3.5 2.6 3.5 5.6" />,
  check: <path d="m5 12 5 5 9-10" />,
  briefcase: <path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Zm6 0V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M3 13h18" />,
  flag: <path d="M5 21V4m0 0h12l-2 4 2 4H5" />,
};

function Icon({ name }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

const verificationStyle = {
  verified: "bg-accent-muted text-accent-dark",
  pending: "bg-warning-light text-warning",
  rejected: "bg-error-light text-error",
  unverified: "bg-surface-muted text-text-secondary",
};

function InstituteContent({ data }) {
  const { institution, pending } = data;
  const students = data.students ?? 0;
  const drives = data.drives ?? [];
  const openDrives = drives.filter((d) => d.status === "open");
  const percentOf = (n) => (students ? Math.round((n / students) * 100) : 0);

  const pipeline = [
    { label: "Students", value: students, tone: "bg-brand-light text-brand", bar: "bg-brand" },
    { label: "Verified Students", value: data.verified ?? 0, tone: "bg-accent-muted text-accent-dark", bar: "bg-accent" },
    { label: "Placement Drives", value: drives.length, tone: "bg-warning-light text-warning", bar: "bg-warning" },
    { label: "Open Drives", value: openDrives.length, tone: "bg-brand-light text-brand", bar: "bg-brand" },
  ];
  const status = [
    { label: "Verified", value: data.verified ?? 0, color: "bg-accent", text: "text-accent-dark" },
    { label: "Pending", value: data.pendingVerification ?? 0, color: "bg-warning", text: "text-warning" },
    { label: "Unverified", value: data.unverified ?? 0, color: "bg-text-muted", text: "text-text-secondary" },
    { label: "Rejected", value: data.rejected ?? 0, color: "bg-error", text: "text-error" },
  ];

  return (
    <>
      <h1 className="text-[22px] tracking-[-0.03em]">Institute Dashboard</h1>
      <p className="mt-1 text-sm text-text-secondary">{institution ? `${institution.name} · Skill development overview` : "Skill development overview"}</p>

      {pending && <PendingNotice kind="institution" />}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Icon name="people" />} label="Total Students" value={students} tone="text-brand" />
        <StatCard icon={<Icon name="check" />} iconTone="bg-accent-muted text-accent-dark" label="Verified Students" value={data.verified ?? 0} tone="text-accent-dark" />
        <StatCard icon={<Icon name="flag" />} iconTone="bg-warning-light text-warning" label="Placement Drives" value={drives.length} tone="text-warning" />
        <StatCard icon={<Icon name="briefcase" />} label="Open Drives" value={openDrives.length} tone="text-brand" />
      </div>

      <Card className="mt-6 p-5">
        <CardHeader title="Skill Development Pipeline" />
        <ol className="mt-5 grid gap-3 md:grid-cols-4">
          {pipeline.map((stage, index) => (
            <li key={stage.label} className={`rounded-lg p-4 text-center ${stage.tone.split(" ")[0]}`}>
              <p className={`text-2xl font-semibold leading-none ${stage.tone.split(" ")[1]}`}>{stage.value}</p>
              <p className={`mt-2 text-sm ${stage.tone.split(" ")[1]}`}>{stage.label}</p>
              <div className="mt-4"><ProgressBar percent={index < 3 ? percentOf(stage.value) : drives.length ? Math.round((stage.value / drives.length) * 100) : 0} color={stage.bar} label={`${stage.label} share`} /></div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Verification Status" />
          <ul className="mt-5 space-y-4">
            {status.map((row) => (
              <li key={row.label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-text-secondary">{row.label}</span>
                  <span className={`font-medium ${row.text}`}>{row.value}/{students}</span>
                </div>
                <ProgressBar percent={percentOf(row.value)} color={row.color} label={`${row.label} students`} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <CardHeader title="Recent Students" />
          {(data.recent ?? []).length === 0 ? (
            <EmptyState>No students imported yet.</EmptyState>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {data.recent.map((student) => (
                <li key={student.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{student.full_name}</p>
                    <p className="truncate text-xs text-text-muted">
                      {[student.program, student.department, student.batch].filter(Boolean).join(" · ") || student.enrollment_id}
                    </p>
                  </div>
                  <Badge className={verificationStyle[student.verification_status] ?? verificationStyle.unverified}>{capitalize(student.verification_status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function InstituteDashboard() {
  const { data, error, loading, reload } = useResource(loadInstituteDashboard);
  return (
    <main className="mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-8">
      <PageState loading={loading} error={error} onRetry={reload}>
        {data && <InstituteContent data={data} />}
      </PageState>
    </main>
  );
}

export default InstituteDashboard;

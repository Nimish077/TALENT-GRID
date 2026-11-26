import { Card, CardHeader, PageState, StatCard } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import { adminApi } from "../../lib/endpoints.js";
import { useResource } from "../../lib/use-resource.js";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function waitingSentence(orgs, institutions) {
  const parts = [];
  if (orgs > 0) parts.push(plural(orgs, "organization"));
  if (institutions > 0) parts.push(plural(institutions, "institution"));
  return `${parts.join(" and ")} ${orgs + institutions === 1 ? "is" : "are"} waiting for approval`;
}

function AdminDashboard() {
  const { data: stats, error, loading, reload } = useResource(() => adminApi.stats());

  const pending = stats ? stats.organizations.pending + stats.institutions.pending : 0;
  const passRate = stats && stats.assessments.completed > 0
    ? Math.round((stats.assessments.passed / stats.assessments.completed) * 100)
    : null;

  return (
    <AppShell title="Admin Dashboard" subtitle="Platform overview and items that need review.">
      <PageState loading={loading} error={error} onRetry={reload}>
        {stats && (
          <div className="space-y-6">
            {pending > 0 ? (
              <Card className="flex flex-wrap items-center justify-between gap-4 border-warning/40 bg-warning-light p-5">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Needs your attention</h2>
                  <p className="mt-1 text-sm text-text-secondary">{waitingSentence(stats.organizations.pending, stats.institutions.pending)}</p>
                </div>
                <Button to="/admin/approvals">Review approvals</Button>
              </Card>
            ) : (
              <Card className="p-5">
                <h2 className="text-[15px] font-semibold tracking-tight">All caught up</h2>
                <p className="mt-1 text-sm text-text-secondary">No organizations or institutions are waiting for approval.</p>
              </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Total users"
                value={stats.users.total}
                hint={`${stats.users.candidates} candidates · ${stats.users.employers} employers · ${stats.users.institutes} institutes`}
              />
              <StatCard label="Verified skills" value={stats.verified_skills} />
              <StatCard
                label="Assessments completed"
                value={stats.assessments.completed}
                hint={passRate === null ? "No attempts yet" : `${passRate}% pass rate`}
              />
              <StatCard label="Published jobs" value={stats.published_jobs} />
              <StatCard label="Applications" value={stats.applications} />
            </div>

            <Card className="p-5">
              <CardHeader title="Platform health" />
              <ul className="mt-3 divide-y divide-border text-sm">
                <li className="flex justify-between py-2.5"><span className="text-text-secondary">Active organizations</span><span className="font-medium">{stats.organizations.active}</span></li>
                <li className="flex justify-between py-2.5"><span className="text-text-secondary">Active institutions</span><span className="font-medium">{stats.institutions.active}</span></li>
              </ul>
            </Card>
          </div>
        )}
      </PageState>
    </AppShell>
  );
}

export default AdminDashboard;

import { useState } from "react";
import { Badge, Card, EmptyState, PageState, PendingNotice } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import { institutionsApi } from "../../lib/endpoints.js";
import { capitalize } from "../../lib/format.js";
import { loadInstituteInstitution } from "../../lib/organization.js";
import { useResource } from "../../lib/use-resource.js";

const verificationStyle = {
  verified: "bg-accent-muted text-accent-dark",
  pending: "bg-warning-light text-warning",
  rejected: "bg-error-light text-error",
  unverified: "bg-surface-muted text-text-secondary",
};

const PAGE_SIZE = 25;

function StudentsPage() {
  const [filters, setFilters] = useState({ search: "", status: "", page: 1 });
  const [draft, setDraft] = useState({ search: "", status: "" });

  const { data, error, loading, reload } = useResource(async () => {
    const inst = await loadInstituteInstitution();
    if (!inst.canManage) return { ...inst, students: [], pagination: null };
    const result = await institutionsApi.memberships(inst.institution.id, {
      limit: PAGE_SIZE,
      page: filters.page,
      search: filters.search.trim() || undefined,
      verification_status: filters.status || undefined,
    });
    return { ...inst, students: result.items, pagination: result.pagination };
  });

  function apply(next) {
    setFilters(next);
    reload();
  }

  const total = data?.pagination?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell title="Students" subtitle={data?.institution ? `${data.institution.name} · ${total} students` : undefined}>
      <PageState loading={loading} error={error} onRetry={reload}>
        {data?.pending && <PendingNotice kind="institution" suspended={data.suspended} />}
        {data && !data.pending && !data.canManage && (
          <Card className="p-5"><EmptyState>Only institution owners and admins can view the student roster.</EmptyState></Card>
        )}
        {data?.canManage && (
          <>
            <form role="search" className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); apply({ ...draft, page: 1 }); }}>
              <input aria-label="Search students" placeholder="Search name, enrollment ID or email" value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} className="h-10 min-w-[240px] flex-1 rounded-[var(--radius)] border border-border bg-surface px-3.5 text-sm focus:border-brand focus:outline-none" />
              <select aria-label="Verification status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="h-10 rounded-[var(--radius)] border border-border bg-surface px-3 text-sm">
                <option value="">All statuses</option>
                {["verified", "pending", "unverified", "rejected"].map((s) => <option key={s} value={s}>{capitalize(s)}</option>)}
              </select>
              <Button type="submit">Search</Button>
            </form>

            <Card className="mt-6 px-5">
              {data.students.length === 0 ? (
                <EmptyState>No students found.</EmptyState>
              ) : (
                <ul className="divide-y divide-border">
                  {data.students.map((student) => (
                    <li key={student.id} className="flex items-center justify-between gap-4 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{student.full_name}</p>
                        <p className="truncate text-xs text-text-muted">
                          {[student.enrollment_id, student.program, student.department, student.batch].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Badge className={verificationStyle[student.verification_status] ?? verificationStyle.unverified}>{capitalize(student.verification_status)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {pages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
                <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => apply({ ...filters, page: filters.page - 1 })}>Previous</Button>
                <span>Page {filters.page} of {pages}</span>
                <Button variant="outline" size="sm" disabled={filters.page >= pages} onClick={() => apply({ ...filters, page: filters.page + 1 })}>Next</Button>
              </div>
            )}
          </>
        )}
      </PageState>
    </AppShell>
  );
}

export default StudentsPage;

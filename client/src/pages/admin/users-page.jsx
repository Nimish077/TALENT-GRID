import { useState } from "react";
import ConfirmDialog from "../../components/admin/confirm-dialog.jsx";
import { InlineError, Pager, StatusBadge } from "../../components/admin/admin-ui.jsx";
import { formatDate, inputClass } from "../../components/admin/admin-utils.js";
import { Badge, Card, EmptyState } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import { useAuth } from "../../context/auth-context.js";
import { adminApi } from "../../lib/endpoints.js";
import { capitalize } from "../../lib/format.js";
import { useResource } from "../../lib/use-resource.js";

const LIMIT = 20;
const ROLES = ["candidate", "employer", "institute", "admin"];
const STATUSES = ["active", "pending", "suspended"];
const roleStyle = {
  admin: "bg-purple-100 text-purple-700",
  employer: "bg-brand-light text-brand",
  institute: "bg-brand-light text-brand",
  candidate: "bg-surface-muted text-text-secondary",
};

function UserAction({ user, self, onToggle }) {
  const label = user.status === "suspended" ? "Reactivate" : "Suspend";
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={self}
      title={self ? "You cannot change your own account" : undefined}
      aria-label={self ? `${label} ${user.email} (you cannot change your own account)` : `${label} ${user.email}`}
      onClick={() => onToggle(user)}
    >
      {label}
    </Button>
  );
}

function UsersPage() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState({ search: "", role: "", status: "", page: 1 });
  const [draft, setDraft] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const list = useResource(() =>
    adminApi.users({
      search: query.search || undefined,
      role: query.role || undefined,
      status: query.status || undefined,
      page: query.page,
      limit: LIMIT,
    }),
  );
  const { reload } = list;

  function apply(next) {
    setQuery(next);
    reload();
  }

  async function runAction() {
    setBusy(true);
    setActionError(null);
    try {
      await adminApi.setUserStatus(confirm.id, confirm.status === "suspended" ? "active" : "suspended");
      setConfirm(null);
      reload();
    } catch (err) {
      setActionError(err.message || "Action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const items = list.data?.items ?? [];
  const total = list.data?.pagination?.total ?? 0;
  const isSelf = (u) => u.id === me?.id;
  const reactivating = confirm?.status === "suspended";

  return (
    <AppShell title="Users" subtitle={list.data ? `${total} ${total === 1 ? "user" : "users"}` : "Manage every account on the platform."}>
      <form
        role="search"
        className="flex flex-wrap gap-3"
        onSubmit={(e) => { e.preventDefault(); apply({ ...query, search: draft.trim(), page: 1 }); }}
      >
        <input aria-label="Search by email" type="search" placeholder="Search by email" value={draft} onChange={(e) => setDraft(e.target.value)} className={`${inputClass} min-w-[200px] flex-1`} />
        <select aria-label="Role" value={query.role} onChange={(e) => apply({ ...query, role: e.target.value, page: 1 })} className={inputClass}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{capitalize(r)}</option>)}
        </select>
        <select aria-label="Status" value={query.status} onChange={(e) => apply({ ...query, status: e.target.value, page: 1 })} className={inputClass}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{capitalize(s)}</option>)}
        </select>
        <Button type="submit">Search</Button>
      </form>

      <div className="mt-5">
        {list.loading && !list.data ? (
          <p role="status" className="py-12 text-center text-sm text-text-secondary">Loading…</p>
        ) : list.error ? (
          <InlineError error={list.error} onRetry={reload} />
        ) : items.length === 0 ? (
          <Card className="px-5"><EmptyState>No users found.</EmptyState></Card>
        ) : (
          <div aria-busy={list.loading}>
            <Card className="hidden overflow-hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-muted text-xs text-text-secondary">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">User</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Role</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Joined</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{u.full_name}</p>
                        <p className="text-xs text-text-muted">{u.email}</p>
                      </td>
                      <td className="px-4 py-3"><Badge className={roleStyle[u.role] ?? roleStyle.candidate}>{capitalize(u.role)}</Badge></td>
                      <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                      <td className="px-4 py-3 text-text-secondary">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-right"><UserAction user={u} self={isSelf(u)} onToggle={setConfirm} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <ul className="space-y-3 md:hidden">
              {items.map((u) => (
                <li key={u.id}>
                  <Card className="p-4">
                    <p className="font-medium">{u.full_name}</p>
                    <p className="break-all text-xs text-text-muted">{u.email}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge className={roleStyle[u.role] ?? roleStyle.candidate}>{capitalize(u.role)}</Badge>
                      <StatusBadge status={u.status} />
                      <span className="text-xs text-text-muted">{formatDate(u.created_at)}</span>
                    </div>
                    <div className="mt-3"><UserAction user={u} self={isSelf(u)} onToggle={setConfirm} /></div>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Pager page={query.page} limit={LIMIT} total={total} onPage={(page) => apply({ ...query, page })} />
      </div>

      {confirm && (
        <ConfirmDialog
          title={reactivating ? "Reactivate this user?" : "Suspend this user?"}
          message={
            reactivating
              ? `${confirm.email} will be able to sign in again.`
              : `${confirm.email} will be blocked from signing in until reactivated.`
          }
          confirmLabel={reactivating ? "Reactivate" : "Suspend"}
          destructive={!reactivating}
          busy={busy}
          error={actionError}
          onConfirm={runAction}
          onCancel={() => { setConfirm(null); setActionError(null); }}
        />
      )}
    </AppShell>
  );
}

export default UsersPage;

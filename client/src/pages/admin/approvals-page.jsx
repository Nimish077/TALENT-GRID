import { useId, useRef, useState } from "react";
import ConfirmDialog from "../../components/admin/confirm-dialog.jsx";
import { InlineError, Pager, StatusBadge } from "../../components/admin/admin-ui.jsx";
import { formatDate, inputClass } from "../../components/admin/admin-utils.js";
import { Card, EmptyState } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import { adminApi } from "../../lib/endpoints.js";
import { useResource } from "../../lib/use-resource.js";

const LIMIT = 20;

const KINDS = {
  employers: {
    label: "Employers",
    noun: "organization",
    list: (p) => adminApi.organizations(p),
    verify: (id) => adminApi.verifyOrganization(id),
    suspend: (id) => adminApi.suspendOrganization(id),
    secondary: (i) => [i.industry, i.location].filter(Boolean).join(" · "),
    counts: (i) => [
      i._count?.users != null && `${i._count.users} member${i._count.users === 1 ? "" : "s"}`,
      i._count?.jobs != null && `${i._count.jobs} job${i._count.jobs === 1 ? "" : "s"}`,
    ],
  },
  institutes: {
    label: "Institutes",
    noun: "institution",
    list: (p) => adminApi.institutions(p),
    verify: (id) => adminApi.verifyInstitution(id),
    suspend: (id) => adminApi.suspendInstitution(id),
    secondary: (i) => [i.code, i.city, i.state].filter(Boolean).join(" · "),
    counts: (i) => [
      i._count?.memberships != null && `${i._count.memberships} student${i._count.memberships === 1 ? "" : "s"}`,
      i._count?.drives != null && `${i._count.drives} drive${i._count.drives === 1 ? "" : "s"}`,
    ],
  },
};
const KIND_KEYS = Object.keys(KINDS);

const STATUS_OPTIONS = [
  ["pending", "Pending"],
  ["active", "Active"],
  ["suspended", "Suspended"],
  ["", "All"],
];

function ApprovalsPage() {
  const baseId = useId();
  const tabRefs = useRef({});
  const [kind, setKind] = useState("employers");
  const [query, setQuery] = useState({ status: "pending", search: "", page: 1 });
  const [draft, setDraft] = useState("");
  const [confirm, setConfirm] = useState(null); // { item, action }
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const config = KINDS[kind];

  const list = useResource(() =>
    config.list({ status: query.status || undefined, search: query.search || undefined, page: query.page, limit: LIMIT }),
  );
  const counts = useResource(async () => {
    const pendingTotal = (key) => KINDS[key].list({ status: "pending", limit: 1 }).then((r) => r.pagination.total);
    const [employers, institutes] = await Promise.all([pendingTotal("employers"), pendingTotal("institutes")]);
    return { employers, institutes };
  });

  const { reload: reloadList } = list;
  function apply(nextKind, nextQuery) {
    setKind(nextKind);
    setQuery(nextQuery);
    reloadList();
  }

  function selectTab(key, focus = false) {
    if (key !== kind) {
      setDraft("");
      apply(key, { ...query, search: "", page: 1 });
    }
    if (focus) tabRefs.current[key]?.focus();
  }

  function onTabKeyDown(event) {
    const index = KIND_KEYS.indexOf(kind);
    let next;
    if (event.key === "ArrowRight") next = KIND_KEYS[(index + 1) % KIND_KEYS.length];
    else if (event.key === "ArrowLeft") next = KIND_KEYS[(index - 1 + KIND_KEYS.length) % KIND_KEYS.length];
    else if (event.key === "Home") next = KIND_KEYS[0];
    else if (event.key === "End") next = KIND_KEYS[KIND_KEYS.length - 1];
    if (next) {
      event.preventDefault();
      selectTab(next, true);
    }
  }

  function closeConfirm() {
    setConfirm(null);
    setActionError(null);
  }

  async function runAction() {
    setBusy(true);
    setActionError(null);
    try {
      const { item, action } = confirm;
      await config[action === "approve" ? "verify" : "suspend"](item.id);
      setConfirm(null);
      reloadList();
      counts.reload();
    } catch (err) {
      setActionError(err.message || "Action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const items = list.data?.items ?? [];
  const total = list.data?.pagination?.total ?? 0;
  const panelId = `${baseId}-panel`;

  return (
    <AppShell title="Approvals" subtitle="Review and manage employer and institute accounts.">
      <div role="tablist" aria-label="Account type" className="flex gap-1 border-b border-border" onKeyDown={onTabKeyDown}>
        {KIND_KEYS.map((key) => {
          const selected = key === kind;
          const pending = counts.data?.[key];
          return (
            <button
              key={key}
              ref={(el) => { tabRefs.current[key] = el; }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${key}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand ${
                selected ? "border-brand text-brand" : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {KINDS[key].label}
              {pending > 0 && (
                <span data-testid={`pending-${key}`} className="rounded-full bg-warning-light px-2 py-0.5 text-xs text-warning">{pending}</span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={`${baseId}-tab-${kind}`} className="mt-5">
        <form
          role="search"
          className="flex flex-wrap gap-3"
          onSubmit={(e) => { e.preventDefault(); apply(kind, { ...query, search: draft.trim(), page: 1 }); }}
        >
          <select
            aria-label="Status"
            value={query.status}
            onChange={(e) => apply(kind, { ...query, status: e.target.value, page: 1 })}
            className={inputClass}
          >
            {STATUS_OPTIONS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
          </select>
          <input
            aria-label="Search by name"
            placeholder="Search by name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={`${inputClass} min-w-[200px] flex-1`}
          />
          <Button type="submit">Search</Button>
        </form>

        <div className="mt-5">
          {list.loading && !list.data ? (
            <p role="status" className="py-12 text-center text-sm text-text-secondary">Loading…</p>
          ) : list.error ? (
            <InlineError error={list.error} onRetry={reloadList} />
          ) : (
            <Card className="px-5" aria-busy={list.loading}>
              {items.length === 0 ? (
                <EmptyState>
                  {query.status === "pending" && !query.search ? `No pending ${config.label.toLowerCase()} to review.` : `No ${config.label.toLowerCase()} found.`}
                </EmptyState>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => {
                    const meta = config.counts(item).filter(Boolean);
                    const secondary = config.secondary(item);
                    return (
                      <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.name}</p>
                          {secondary && <p className="truncate text-xs text-text-muted">{secondary}</p>}
                          <p className="mt-0.5 text-xs text-text-muted">
                            Registered {formatDate(item.created_at)}{meta.length > 0 && ` · ${meta.join(" · ")}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={item.status} />
                          {item.status === "active" ? (
                            <Button variant="outline" size="sm" aria-label={`Suspend ${item.name}`} onClick={() => setConfirm({ item, action: "suspend" })}>Suspend</Button>
                          ) : (
                            <Button size="sm" aria-label={`Approve ${item.name}`} onClick={() => setConfirm({ item, action: "approve" })}>Approve</Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}
          <Pager page={query.page} limit={LIMIT} total={total} onPage={(page) => apply(kind, { ...query, page })} />
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.action === "approve" ? `Approve ${confirm.item.name}?` : `Suspend ${confirm.item.name}?`}
          message={
            confirm.action === "approve"
              ? `This ${config.noun} will become active and its owners will gain full access.`
              : `This ${config.noun} will be suspended and its members will lose access until it is approved again.`
          }
          confirmLabel={confirm.action === "approve" ? "Approve" : "Suspend"}
          destructive={confirm.action === "suspend"}
          busy={busy}
          error={actionError}
          onConfirm={runAction}
          onCancel={closeConfirm}
        />
      )}
    </AppShell>
  );
}

export default ApprovalsPage;

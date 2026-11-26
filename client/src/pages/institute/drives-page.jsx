import { useState } from "react";
import ConfirmDialog from "../../components/admin/confirm-dialog.jsx";
import { Card, EmptyState, PageState, PendingNotice } from "../../components/dashboard/primitives.jsx";
import DriveCard from "../../components/institute/drive-card.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import { drivesApi, institutionsApi } from "../../lib/endpoints.js";
import { loadInstituteInstitution } from "../../lib/organization.js";
import { useResource } from "../../lib/use-resource.js";

export default function DrivesPage() {
  const [pendingAction, setPendingAction] = useState(null); // { drive, action }
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const { data, error, loading, reload } = useResource(async () => {
    const inst = await loadInstituteInstitution();
    if (inst.pending || !inst.institution) return { ...inst, drives: [] };
    const result = await institutionsApi.drives(inst.institution.id);
    return { ...inst, drives: result.drives ?? [] };
  });

  function ask(drive, action) {
    setActionError("");
    setPendingAction({ drive, action });
  }

  function dismiss() {
    if (busy) return;
    setPendingAction(null);
    setActionError("");
  }

  async function confirm() {
    setBusy(true);
    setActionError("");
    try {
      await drivesApi[pendingAction.action](pendingAction.drive.id);
      setPendingAction(null);
      reload();
    } catch (err) {
      setActionError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const opening = pendingAction?.action === "open";

  return (
    <AppShell title="Placement Drives" subtitle={data?.institution ? data.institution.name : undefined}>
      <PageState loading={loading} error={error} onRetry={reload}>
        {data?.pending && <PendingNotice kind="institution" suspended={data.suspended} />}
        {data && !data.pending && (
          data.drives.length === 0 ? (
            <Card className="p-5"><EmptyState>No placement drives yet</EmptyState></Card>
          ) : (
            <ul className="space-y-4">
              {data.drives.map((drive) => (
                <li key={drive.id}>
                  <DriveCard drive={drive} canManage={data.canManage} busy={busy} onAction={ask} />
                </li>
              ))}
            </ul>
          )
        )}
      </PageState>
      {pendingAction && (
        <ConfirmDialog
          title={opening ? "Open this drive?" : "Close this drive?"}
          message={opening
            ? `"${pendingAction.drive.title}" will accept applications from eligible students.`
            : `"${pendingAction.drive.title}" will stop accepting applications.`}
          confirmLabel={opening ? "Open drive" : "Close drive"}
          destructive={!opening}
          busy={busy}
          error={actionError}
          onConfirm={confirm}
          onCancel={dismiss}
        />
      )}
    </AppShell>
  );
}

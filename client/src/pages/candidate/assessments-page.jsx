import { useState } from "react";
import { Badge, Card, EmptyState, PageState } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import { assessmentsApi } from "../../lib/endpoints.js";
import { capitalize } from "../../lib/format.js";
import { useResource } from "../../lib/use-resource.js";

const resultStyle = {
  pending: "bg-warning-light text-warning",
  passed: "bg-accent-muted text-accent-dark",
  failed: "bg-error-light text-error",
};

async function loadAssessments() {
  const [catalog, attempts] = await Promise.all([assessmentsApi.list({ limit: 50 }), assessmentsApi.attemptsMine()]);
  return { assessments: catalog.items, attempts: attempts.attempts };
}

function AssessmentsPage() {
  const { data, error, loading, reload } = useResource(loadAssessments);
  const [pendingId, setPendingId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function run(id, action) {
    setPendingId(id);
    setActionError("");
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  const attempts = data?.attempts ?? [];
  const openAttempt = (assessmentId) =>
    attempts.find((a) => a.assessment_id === assessmentId && a.result_status === "pending");
  const best = (assessmentId) =>
    attempts.filter((a) => a.assessment_id === assessmentId && a.result_status === "passed")[0];

  return (
    <AppShell title="Skill Assessments" subtitle="Pass an assessment to turn a claimed skill into a verified one.">
      {actionError && <p role="alert" className="mb-4 text-sm text-error">{actionError}</p>}
      <PageState loading={loading} error={error} onRetry={reload}>
        {data?.assessments.length === 0 ? (
          <Card className="p-5"><EmptyState>No assessments are open right now. Check back soon.</EmptyState></Card>
        ) : (
          <ul className="space-y-4">
            {data?.assessments.map((assessment) => {
              const open = openAttempt(assessment.id);
              const passed = best(assessment.id);
              return (
                <li key={assessment.id}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold tracking-tight">{assessment.title}</h2>
                        <p className="mt-1 text-[13px] text-text-secondary">
                          {[capitalize(assessment.assessment_type), capitalize(assessment.difficulty), assessment.duration_minutes && `${assessment.duration_minutes} min`].filter(Boolean).join(" · ")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(assessment.skills ?? []).map((link) => (
                            <Badge key={link.id ?? link.skill_id} className="border border-border bg-surface font-normal text-text-primary">{link.skill?.name}{link.target_level && <span className="ml-1 text-text-muted">· {capitalize(link.target_level)}</span>}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {passed && <Badge className={resultStyle.passed}>✓ Passed</Badge>}
                        {open ? (
                          <>
                            <Badge className={resultStyle.pending}>In progress</Badge>
                            <Button size="sm" variant="outline" disabled={pendingId === assessment.id} onClick={() => run(assessment.id, () => assessmentsApi.abandonAttempt(open.id))}>
                              Abandon
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" disabled={pendingId === assessment.id} onClick={() => run(assessment.id, () => assessmentsApi.startAttempt(assessment.id))}>
                            {pendingId === assessment.id ? "Starting…" : passed ? "Retake" : "Start"}
                          </Button>
                        )}
                      </div>
                    </div>
                    {open && (
                      <p className="mt-3 text-xs text-text-muted">
                        Attempt #{open.attempt_number} started. Questions are delivered by the assessment engine; your result will appear here once it is scored.
                      </p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </PageState>
    </AppShell>
  );
}

export default AssessmentsPage;

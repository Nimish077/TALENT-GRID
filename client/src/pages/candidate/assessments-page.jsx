import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatClock, levelStyle, useNow } from "../../components/assessment/clock.js";
import { Badge, Card, CardHeader, EmptyState, PageState } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import { assessmentsApi } from "../../lib/endpoints.js";
import { capitalize } from "../../lib/format.js";
import { useResource } from "../../lib/use-resource.js";

const resultStyle = {
  pending: "bg-warning-light text-warning",
  passed: "bg-accent-muted text-accent-dark",
  failed: "bg-error-light text-error",
  abandoned: "bg-surface-muted text-text-secondary",
};

const resultLabel = { pending: "In progress", passed: "Passed", failed: "Not passed", abandoned: "Abandoned" };

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

async function loadAssessments() {
  const [catalog, attempts] = await Promise.all([assessmentsApi.list({ limit: 50 }), assessmentsApi.attemptsMine()]);
  return { assessments: catalog.items ?? [], attempts: attempts.attempts ?? [] };
}

const RULES = [
  "The test is timed and cannot be paused once you begin.",
  "Your answers are saved automatically as you select them.",
  "Leaving this tab or window is recorded and shown to employers.",
  "Harder questions count for more than easier ones.",
  "You will see your result immediately after submitting.",
  "If you do not pass, you can retake it after a short cooldown.",
];

function StartPanel({ assessment, busy, error, onBegin, onCancel }) {
  return (
    <div role="region" aria-label={`Before you begin ${assessment.title}`} className="mt-4 rounded-lg border border-brand/20 bg-brand-light p-4">
      <p className="text-sm font-semibold">Before you begin</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-text-secondary">
        {RULES.map((rule) => <li key={rule}>{rule}</li>)}
      </ul>
      {error && <p role="alert" className="mt-3 text-[13px] text-error">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={onBegin}>{busy ? "Starting…" : `Begin test (${assessment.duration_minutes} min)`}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function AssessmentAction({ assessment, onStart }) {
  const status = assessment.my_status ?? {};
  const retryAt = status.retry_at ? new Date(status.retry_at).getTime() : null;
  const now = useNow(1000, Boolean(retryAt));

  if (!assessment.question_count) return <Button size="sm" disabled>Not available yet</Button>;
  if (status.open_attempt_id) return <Button size="sm" to={`/assessments/attempts/${status.open_attempt_id}`}>Resume</Button>;
  if (retryAt && retryAt > now) {
    return <Button size="sm" disabled aria-label={`Retake available in ${formatClock(retryAt - now)}`}>Retake in {formatClock(retryAt - now)}</Button>;
  }
  return <Button size="sm" onClick={onStart}>{status.attempts > 0 ? "Retake" : "Start"}</Button>;
}

function AssessmentCard({ assessment, expanded, onStart, onCancel, onBegin, busy, error }) {
  const status = assessment.my_status ?? {};
  const last = status.last_result;
  const meta = [
    assessment.question_count ? `${assessment.question_count} questions` : null,
    assessment.duration_minutes ? `${assessment.duration_minutes} minutes` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{assessment.title}</h2>
          {meta && <p className="mt-1 text-[13px] text-text-secondary">{meta}</p>}
          <ul className="mt-3 space-y-1.5">
            {(assessment.skills ?? []).map((link) => {
              const mine = link.mine;
              const verified = mine?.verification_status === "verified";
              return (
                <li key={link.id ?? link.skill?.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-medium">{link.skill?.name}</span>
                  {link.target_level && <span className="text-text-muted">target {capitalize(link.target_level)}</span>}
                  {verified ? (
                    <Badge className={`${levelStyle[mine.verified_level] ?? "bg-accent-muted text-accent-dark"}`}>✓ Verified at {capitalize(mine.verified_level)}</Badge>
                  ) : (
                    <Badge className="bg-surface-muted text-text-secondary">Not verified</Badge>
                  )}
                </li>
              );
            })}
          </ul>
          {(last || status.best_score != null) && (
            <p className="mt-3 text-xs text-text-secondary">
              {last && (
                <>
                  Last result: <Badge className={`${resultStyle[last.result_status] ?? ""} !px-1.5 !py-0.5`}>{resultLabel[last.result_status] ?? last.result_status}</Badge>
                  {last.score != null && <> {Math.round(Number(last.score))}%</>}
                  {last.submitted_at && <> on {formatDate(last.submitted_at)}</>}
                </>
              )}
              {status.best_score != null && <>{last ? " · " : ""}Best score {Math.round(Number(status.best_score))}%</>}
            </p>
          )}
        </div>
        <AssessmentAction assessment={assessment} onStart={onStart} />
      </div>
      {expanded && <StartPanel assessment={assessment} busy={busy} error={error} onBegin={onBegin} onCancel={onCancel} />}
    </Card>
  );
}

function AttemptsHistory({ attempts }) {
  return (
    <Card className="p-5">
      <CardHeader title="Your attempts" />
      {attempts.length === 0 ? (
        <EmptyState>You have not taken any assessments yet.</EmptyState>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {attempts.map((attempt) => {
            const finished = attempt.result_status === "passed" || attempt.result_status === "failed";
            const target = finished || attempt.result_status === "pending" ? `/assessments/attempts/${attempt.id}` : null;
            return (
              <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
                <span className="min-w-0 font-medium">{attempt.assessment?.title ?? "Assessment"}</span>
                <span className="flex items-center gap-3 text-text-secondary">
                  <Badge className={resultStyle[attempt.result_status] ?? ""}>{resultLabel[attempt.result_status] ?? attempt.result_status}</Badge>
                  {finished && attempt.score != null && <span>{Math.round(Number(attempt.score))}%{attempt.level ? ` · ${capitalize(attempt.level)}` : ""}</span>}
                  {attempt.submitted_at && <span className="text-xs text-text-muted">{formatDate(attempt.submitted_at)}</span>}
                  {target && (
                    <Link to={target} className="font-medium text-brand hover:text-brand-dark">
                      {finished ? "View result" : "Resume"}
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function AssessmentsPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useResource(loadAssessments);
  const [confirmId, setConfirmId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  async function begin(assessment) {
    setStarting(true);
    setStartError("");
    try {
      const res = await assessmentsApi.startAttempt(assessment.id);
      navigate(`/assessments/attempts/${res.attempt.id}`);
    } catch (err) {
      const detail = err.details?.[0];
      if (err.status === 409 && detail?.path === "attempt_id") {
        navigate(`/assessments/attempts/${detail.message}`);
        return;
      }
      if (err.status === 409 && detail?.path === "retry_at") {
        setConfirmId(null);
        reload();
      }
      setStartError(err.message);
      setStarting(false);
    }
  }

  return (
    <AppShell title="Skill Assessments" subtitle="Pass an assessment to turn a claimed skill into a verified one.">
      <PageState loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <div className="space-y-6">
            {startError && !confirmId && <p role="alert" className="text-sm text-error">{startError}</p>}
            {data.assessments.length === 0 ? (
              <Card className="p-5"><EmptyState>No assessments are open right now. Check back soon.</EmptyState></Card>
            ) : (
              <ul className="space-y-4">
                {data.assessments.map((assessment) => (
                  <li key={assessment.id}>
                    <AssessmentCard
                      assessment={assessment}
                      expanded={confirmId === assessment.id}
                      busy={starting}
                      error={confirmId === assessment.id ? startError : ""}
                      onStart={() => { setStartError(""); setConfirmId(assessment.id); }}
                      onCancel={() => setConfirmId(null)}
                      onBegin={() => begin(assessment)}
                    />
                  </li>
                ))}
              </ul>
            )}
            <AttemptsHistory attempts={data.attempts} />
          </div>
        )}
      </PageState>
    </AppShell>
  );
}

export default AssessmentsPage;

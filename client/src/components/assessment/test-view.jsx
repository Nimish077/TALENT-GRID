import { useCallback, useEffect, useRef, useState } from "react";
import { assessmentsApi } from "../../lib/endpoints.js";
import { Card, ProgressBar } from "../dashboard/primitives.jsx";
import Button from "../ui/button.jsx";
import { formatClock, useNow } from "./clock.js";

const FOCUS_THROTTLE_MS = 3000;

function timerTone(remainingMs) {
  if (remainingMs <= 60_000) return "border-error/30 bg-error-light text-error";
  if (remainingMs <= 300_000) return "border-warning/30 bg-warning-light text-warning";
  return "border-border bg-surface text-text-primary";
}

function SaveIndicator({ state, onRetry }) {
  return (
    <p role="status" aria-live="polite" className="h-5 text-xs">
      {state === "saving" && <span className="text-text-muted">Saving…</span>}
      {state === "saved" && <span className="text-accent-dark">Saved</span>}
      {state === "error" && (
        <span className="text-error">
          Could not save -{" "}
          <button type="button" onClick={onRetry} className="font-medium underline focus-visible:outline-2 focus-visible:outline-brand">retry</button>
        </span>
      )}
    </p>
  );
}

// The pending-attempt UI. `attempt`/`questions` come from GET /attempts/:id.
function TestView({ attempt, questions, onGraded, onReload }) {
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(questions.filter((q) => q.selected_option_id).map((q) => [q.id, q.selected_option_id])),
  );
  const [index, setIndex] = useState(0);
  const [saveState, setSaveState] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [focusNotice, setFocusNotice] = useState(false);
  const submittedRef = useRef(false);
  const seqRef = useRef({});
  const lastFocusLossRef = useRef(0);

  // The server owns the clock: offset our clock against its time at load.
  const [clock] = useState(() => ({
    offset: attempt.server_time ? Date.parse(attempt.server_time) - Date.now() : 0,
    deadline: Date.parse(attempt.expires_at),
  }));
  const now = useNow(1000);
  const remaining = clock.deadline - (now + clock.offset);
  const expired = remaining <= 0;

  const total = questions.length;
  const answered = questions.filter((q) => answers[q.id]).length;
  const question = questions[index];

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await assessmentsApi.submit(attempt.id);
      onGraded(res);
    } catch (err) {
      if (err.status === 409) {
        // Already graded server-side (for example the deadline passed).
        onReload();
        return;
      }
      submittedRef.current = false;
      setSubmitting(false);
      setSubmitError(err.message);
    }
  }, [attempt.id, onGraded, onReload]);

  // Auto-submit when the server deadline is reached.
  useEffect(() => {
    if (expired) Promise.resolve().then(submit);
  }, [expired, submit]);

  // Leaving the page is an integrity signal; throttle to once per 3 seconds.
  useEffect(() => {
    function recordLeave() {
      const at = Date.now();
      if (at - lastFocusLossRef.current < FOCUS_THROTTLE_MS) return;
      lastFocusLossRef.current = at;
      setFocusNotice(true);
      // Best-effort signal: failures must never interrupt the test.
      try {
        assessmentsApi.focusLoss(attempt.id)?.catch?.(() => {});
      } catch {
        /* ignore */
      }
    }
    const onVisibility = () => document.visibilityState === "hidden" && recordLeave();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", recordLeave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", recordLeave);
    };
  }, [attempt.id]);

  useEffect(() => {
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  async function save(questionId, optionId) {
    const seq = (seqRef.current[questionId] = (seqRef.current[questionId] ?? 0) + 1);
    const mark = (state) => seqRef.current[questionId] === seq && setSaveState((s) => ({ ...s, [questionId]: state }));
    setSaveState((s) => ({ ...s, [questionId]: "saving" }));
    try {
      await assessmentsApi.saveAnswer(attempt.id, questionId, optionId);
      mark("saved");
    } catch (err) {
      if (err.status === 409) {
        onReload();
        return;
      }
      mark("error");
    }
  }

  function choose(questionId, optionId) {
    if (expired || submitting) return;
    setAnswers((a) => ({ ...a, [questionId]: optionId }));
    save(questionId, optionId);
  }

  const announcement = remaining <= 60_000 ? "1 minute remaining" : remaining <= 300_000 ? "5 minutes remaining" : "";
  const unanswered = total - answered;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="min-w-[140px] flex-1">
          <p className="text-[13px] text-text-secondary">Answered {answered} of {total}</p>
          <div className="mt-1.5"><ProgressBar percent={total ? (answered / total) * 100 : 0} label="Questions answered" /></div>
        </div>
        <div role="timer" aria-label="Time remaining" className={`rounded-lg border px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${timerTone(remaining)}`}>
          {formatClock(remaining)}
        </div>
      </div>
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>

      {focusNotice && (
        <p role="status" className="rounded-lg border border-warning/30 bg-warning-light px-3 py-2 text-[13px] text-text-primary">
          Leaving this page is recorded and shown to employers.
        </p>
      )}

      <nav aria-label="Question navigator" className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const done = Boolean(answers[q.id]);
          return (
            <button
              key={q.id}
              type="button"
              aria-label={`Question ${i + 1}, ${done ? "answered" : "not answered"}`}
              aria-current={i === index ? "step" : undefined}
              onClick={() => setIndex(i)}
              className={`h-9 w-9 rounded-lg border text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                i === index ? "border-brand bg-brand text-surface" : done ? "border-accent/40 bg-accent-light text-accent-dark" : "border-border bg-surface text-text-secondary hover:bg-surface-muted"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      <Card className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Question {index + 1} of {total}</p>
        <h2 id={`q-${question.id}`} className="mt-2 whitespace-pre-wrap text-[15px] font-semibold leading-snug">{question.prompt}</h2>
        <div role="radiogroup" aria-labelledby={`q-${question.id}`} className="mt-4 space-y-2">
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3.5 py-3 text-sm hover:bg-surface-muted has-[:checked]:border-brand has-[:checked]:bg-brand-light has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40"
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                value={option.id}
                checked={answers[question.id] === option.id}
                onChange={() => choose(question.id, option.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
              />
              <span>{option.text}</span>
            </label>
          ))}
        </div>
        <div className="mt-3"><SaveIndicator state={saveState[question.id]} onRetry={() => answers[question.id] && save(question.id, answers[question.id])} /></div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</Button>
          {index < total - 1 ? (
            <Button size="sm" onClick={() => setIndex(index + 1)}>Next</Button>
          ) : (
            <Button size="sm" disabled={confirming || submitting} onClick={() => setConfirming(true)}>Review and submit</Button>
          )}
        </div>
      </Card>

      {confirming ? (
        <div role="alertdialog" aria-label="Confirm submission" className="rounded-xl border border-brand/30 bg-brand-light p-4">
          <p className="text-sm font-semibold">Submit your test?</p>
          <p className="mt-1 text-[13px] text-text-secondary">
            {unanswered > 0
              ? `You have ${unanswered} unanswered ${unanswered === 1 ? "question" : "questions"}. Unanswered questions score zero.`
              : "You have answered every question."}{" "}
            You cannot change your answers after submitting.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit now"}</Button>
            <Button size="sm" variant="ghost" disabled={submitting} onClick={() => setConfirming(false)}>Keep working</Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" disabled={submitting} onClick={() => setConfirming(true)}>Submit test</Button>
        </div>
      )}
      {expired && submitting && <p role="status" className="text-sm text-text-secondary">Time is up. Submitting your answers…</p>}
      {submitError && (
        <p role="alert" className="text-sm text-error">
          {submitError}{" "}
          <button type="button" onClick={submit} className="font-medium underline">Try again</button>
        </p>
      )}
    </div>
  );
}

export default TestView;

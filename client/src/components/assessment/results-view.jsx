import { useEffect, useState } from "react";
import { assessmentsApi } from "../../lib/endpoints.js";
import { capitalize } from "../../lib/format.js";
import { Badge, Card } from "../dashboard/primitives.jsx";
import Button from "../ui/button.jsx";
import { formatClock, levelStyle, useNow } from "./clock.js";

const difficultyStyle = {
  beginner: "bg-surface-muted text-text-secondary",
  intermediate: "bg-brand-light text-brand",
  advanced: "bg-purple-100 text-purple-700",
};

// Best-effort: the attempt payload has no cooldown, but the catalogue does.
function useRetryAt(attempt, enabled) {
  const [retryAt, setRetryAt] = useState(null);
  const assessmentId = attempt.assessment?.id;
  useEffect(() => {
    if (!enabled || !assessmentId) return undefined;
    let active = true;
    Promise.resolve()
      .then(() => assessmentsApi.list({ limit: 50 }))
      .then((res) => {
        const mine = res?.items?.find((a) => a.id === assessmentId)?.my_status?.retry_at;
        if (active && mine) setRetryAt(Date.parse(mine));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [enabled, assessmentId]);
  return retryAt;
}

function Verdict({ attempt }) {
  const passed = attempt.result_status === "passed";
  const retryAt = useRetryAt(attempt, !passed);
  const now = useNow(1000, Boolean(retryAt));
  const wait = retryAt ? retryAt - now : 0;

  if (passed) {
    return (
      <p className="mt-3 inline-flex items-center rounded-lg bg-accent-muted px-3 py-1.5 text-sm font-semibold text-accent-dark">
        ✓ Skill verified at {capitalize(attempt.level)} level
      </p>
    );
  }
  return (
    <p className="mt-3 inline-flex items-center rounded-lg bg-error-light px-3 py-1.5 text-sm font-semibold text-error">
      Not passed this time{wait > 0 ? ` - retake in ${formatClock(wait)}` : " - you can retake after a short cooldown"}
    </p>
  );
}

function Review({ question, number }) {
  const answered = Boolean(question.selected_option_id);
  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Question {number}</span>
        {question.difficulty && <Badge className={`!px-2 !py-0.5 ${difficultyStyle[question.difficulty] ?? ""}`}>{capitalize(question.difficulty)}</Badge>}
        <Badge className={`!px-2 !py-0.5 ${question.is_correct ? "bg-accent-muted text-accent-dark" : "bg-error-light text-error"}`}>
          {question.is_correct ? "Correct" : answered ? "Incorrect" : "Not answered"}
        </Badge>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm font-medium">{question.prompt}</p>
      <ul className="mt-3 space-y-1.5">
        {question.options.map((option) => {
          const isCorrect = option.id === question.correct_option_id;
          const isMine = option.id === question.selected_option_id;
          const tone = isCorrect ? "border-accent/50 bg-accent-light" : isMine ? "border-error/40 bg-error-light" : "border-border";
          return (
            <li key={option.id} className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-[13px] ${tone}`}>
              <span>{option.text}</span>
              <span className="shrink-0 text-xs font-medium">
                {isCorrect && <span className="text-accent-dark">Correct answer</span>}
                {isMine && <span className={isCorrect ? "ml-2 text-accent-dark" : "text-error"}>Your answer</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {question.explanation && <p className="mt-3 text-[13px] text-text-secondary"><span className="font-medium text-text-primary">Explanation: </span>{question.explanation}</p>}
    </li>
  );
}

function ResultsView({ attempt, questions }) {
  if (attempt.result_status === "abandoned") {
    return (
      <Card className="p-6">
        <p className="text-[15px] font-semibold">This attempt was abandoned</p>
        <p className="mt-1 text-sm text-text-secondary">It was not graded and did not change your skills. You can start a new attempt from the assessments page.</p>
        <div className="mt-4"><Button size="sm" to="/assessments">Back to assessments</Button></div>
      </Card>
    );
  }

  const score = attempt.score != null ? Math.round(Number(attempt.score)) : 0;
  const total = attempt.question_count ?? questions.length;
  const correct = attempt.correct_count ?? questions.filter((q) => q.is_correct).length;
  const passed = attempt.result_status === "passed";

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <p aria-label={`Score ${score} percent`} className={`text-[44px] font-semibold leading-none tracking-[-0.03em] ${passed ? "text-accent-dark" : "text-text-primary"}`}>{score}%</p>
          {attempt.level && <Badge className={levelStyle[attempt.level] ?? ""}>{capitalize(attempt.level)} level</Badge>}
        </div>
        <Verdict attempt={attempt} />
        <p className="mt-3 text-[13px] text-text-secondary">{correct} of {total} questions correct. Harder questions count for more.</p>
        {attempt.focus_losses > 0 && (
          <p className="mt-2 text-[13px] text-warning">
            You left the test page {attempt.focus_losses} {attempt.focus_losses === 1 ? "time" : "times"}. This is recorded and visible to employers.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" to="/assessments">Back to assessments</Button>
          <Button size="sm" variant="outline" to="/skills">View my skills</Button>
        </div>
      </Card>

      <section aria-label="Question review">
        <h2 className="text-[15px] font-semibold tracking-tight">Review your answers</h2>
        <ol className="mt-3 space-y-3">
          {questions.map((q, i) => <Review key={q.id} question={q} number={i + 1} />)}
        </ol>
      </section>
    </div>
  );
}

export default ResultsView;

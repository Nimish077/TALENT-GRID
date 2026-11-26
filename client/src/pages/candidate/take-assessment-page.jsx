import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import ResultsView from "../../components/assessment/results-view.jsx";
import TestView from "../../components/assessment/test-view.jsx";
import { PageState } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import { assessmentsApi } from "../../lib/endpoints.js";
import { useResource } from "../../lib/use-resource.js";

function AttemptContent({ attemptId }) {
  const { data, error, loading, reload } = useResource(() => assessmentsApi.getAttempt(attemptId));
  const [graded, setGraded] = useState(null);

  const view = graded ?? data;
  const attempt = view?.attempt;
  const pending = attempt?.result_status === "pending";

  const frame = (children, title = attempt?.assessment?.title ?? "Skill Test") => (
    <AppShell title={title} width="max-w-3xl" back={{ to: "/assessments", label: "Assessments" }}>
      {children}
    </AppShell>
  );

  if (error?.status === 404) {
    return frame(
      <div role="alert" className="py-16 text-center">
        <p>We could not find that attempt.</p>
        <Link to="/assessments" className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-dark">Back to assessments</Link>
      </div>,
      "Skill Test",
    );
  }

  return frame(
    <PageState loading={loading && !view} error={error} onRetry={reload}>
      {view &&
        (pending ? (
          <TestView key={attempt.id} attempt={attempt} questions={view.questions} onGraded={setGraded} onReload={reload} />
        ) : (
          <ResultsView attempt={attempt} questions={view.questions ?? []} />
        ))}
    </PageState>,
  );
}

export default function TakeAssessmentPage() {
  const { attemptId } = useParams();
  return <AttemptContent key={attemptId} attemptId={attemptId} />;
}

import { useParams } from "react-router-dom";
import { Badge, Card, CardHeader, EmptyState } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import { Avatar, InviteControl, VerifiedChip } from "../../components/talent/talent-ui.jsx";
import { talentApi } from "../../lib/endpoints.js";
import { capitalize } from "../../lib/format.js";
import { useResource } from "../../lib/use-resource.js";

const BACK = { to: "/employer/talent", label: "Talent search" };

const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "";
const fmtMonth = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short" }) : "";
const range = (start, end, current) => [fmtMonth(start), current ? "Present" : fmtMonth(end)].filter(Boolean).join(" – ");

function Section({ title, items, children }) {
  if (!items?.length) return null;
  return (
    <Card className="p-5">
      <CardHeader title={title} />
      <ul className="mt-4 divide-y divide-border">{children}</ul>
    </Card>
  );
}

function Entry({ title, meta, children }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <p className="text-sm font-medium">{title}</p>
      {meta && <p className="text-xs text-text-secondary">{meta}</p>}
      {children}
    </li>
  );
}

function Evidence({ evidence }) {
  return (
    <Card className="p-5">
      <CardHeader title="Assessment evidence" />
      {evidence.length === 0 ? (
        <EmptyState>No assessments taken yet</EmptyState>
      ) : (
        <ul className="mt-4 space-y-3">
          {evidence.map((e) => {
            const passed = e.result_status === "passed";
            return (
              <li key={e.attempt_id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{e.assessment_title}</p>
                  <Badge className={passed ? "bg-accent-muted text-accent-dark" : "bg-error-light text-error"}>{passed ? "Passed" : "Failed"}</Badge>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  Score {e.score}%
                  {e.level ? ` · ${capitalize(e.level)}` : ""} · {e.correct_count}/{e.question_count} correct
                  {e.evaluated_at ? ` · ${fmtDate(e.evaluated_at)}` : ""}
                </p>
                {e.skills?.length > 0 && <p className="mt-1 text-xs text-text-muted">{e.skills.join(", ")}</p>}
                {e.focus_losses > 0 && (
                  <p className="mt-2 text-xs text-warning">
                    Integrity note: Left the test window {e.focus_losses} {e.focus_losses === 1 ? "time" : "times"}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Detail({ data, candidateId }) {
  const { profile, assessment_evidence: evidence = [] } = data;
  const name = profile.user?.full_name ?? "Candidate";
  const skills = profile.skills ?? [];
  const verified = skills.filter((s) => s.verification_status === "verified");
  const claimed = skills.filter((s) => s.verification_status !== "verified");
  const links = [
    ["GitHub", profile.github_url],
    ["LinkedIn", profile.linkedin_url],
    ["Portfolio", profile.portfolio_url],
    ["Resume", profile.resume_url],
  ].filter(([, url]) => url);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={name} size="h-14 w-14 text-base" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
            {profile.headline && <p className="text-sm text-text-secondary">{profile.headline}</p>}
            {profile.location && <p className="text-xs text-text-muted">{profile.location}</p>}
            {links.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {links.map(([label, url]) => (
                  <a key={label} href={url} target="_blank" rel="noreferrer" className="text-brand hover:text-brand-dark">{label}</a>
                ))}
              </p>
            )}
          </div>
          <InviteControl candidateProfileId={candidateId} />
        </div>
        {profile.bio && <p className="mt-4 whitespace-pre-line text-sm text-text-secondary">{profile.bio}</p>}
      </Card>

      <Card className="p-5">
        <CardHeader title="Verified skills" />
        {verified.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">No verified skills yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {verified.map((s) => (
              <li key={s.skill.name} className="flex items-center gap-1.5">
                <VerifiedChip level={s.verified_level}>{s.skill.name}</VerifiedChip>
                <Badge className="bg-accent-muted text-accent-dark">Verified</Badge>
              </li>
            ))}
          </ul>
        )}
        {claimed.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-[13px] font-semibold text-text-secondary">Claimed skills (not verified)</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {claimed.map((s) => (
                <li key={s.skill.name} className="rounded-full border border-dashed border-border-strong px-2.5 py-1 text-xs text-text-secondary">
                  {s.skill.name}{s.declared_level ? ` · ${capitalize(s.declared_level)} (self-declared)` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Evidence evidence={evidence} />

      <Section title="Experience" items={profile.experiences}>
        {profile.experiences?.map((x) => (
          <Entry key={x.id} title={`${x.job_title} at ${x.organization_name}`} meta={range(x.start_date, x.end_date, x.is_current)}>
            {x.description && <p className="mt-1 text-sm text-text-secondary">{x.description}</p>}
          </Entry>
        ))}
      </Section>
      <Section title="Education" items={profile.educations}>
        {profile.educations?.map((x) => (
          <Entry
            key={x.id}
            title={`${x.degree}${x.field_of_study ? `, ${x.field_of_study}` : ""}`}
            meta={`${x.institution_name} · ${x.start_year}${x.end_year ? `–${x.end_year}` : " – Present"}`}
          />
        ))}
      </Section>
      <Section title="Projects" items={profile.projects}>
        {profile.projects?.map((x) => (
          <Entry key={x.id} title={x.title} meta={range(x.start_date, x.end_date)}>
            {x.description && <p className="mt-1 text-sm text-text-secondary">{x.description}</p>}
            {(x.project_url || x.github_url) && (
              <p className="mt-1 flex gap-3 text-xs">
                {x.project_url && <a href={x.project_url} target="_blank" rel="noreferrer" className="text-brand">Project</a>}
                {x.github_url && <a href={x.github_url} target="_blank" rel="noreferrer" className="text-brand">GitHub</a>}
              </p>
            )}
          </Entry>
        ))}
      </Section>
      <Section title="Certifications" items={profile.certifications}>
        {profile.certifications?.map((x) => (
          <Entry key={x.id} title={x.name} meta={[x.issuing_organization, fmtMonth(x.issue_date)].filter(Boolean).join(" · ")} />
        ))}
      </Section>
    </div>
  );
}

export default function CandidateDetailPage() {
  const { candidateId } = useParams();
  const { data, error, loading, reload } = useResource(() => talentApi.detail(candidateId));

  let body;
  if (loading) {
    body = <p role="status" className="py-16 text-center text-text-secondary">Loading candidate…</p>;
  } else if (error?.status === 404) {
    body = <p role="alert" className="py-16 text-center text-text-secondary">Candidate not found or profile is private</p>;
  } else if (error?.status === 403) {
    body = (
      <div role="status" className="rounded-xl border border-warning/30 bg-warning-light p-5 text-sm">
        <p className="font-semibold">Verification pending</p>
        <p className="mt-1 text-text-secondary">{error.message}</p>
      </div>
    );
  } else if (error) {
    body = (
      <div role="alert" className="py-16 text-center">
        <p className="text-sm">{error.message}</p>
        <button type="button" onClick={reload} className="mt-3 text-sm font-medium text-brand hover:text-brand-dark">Try again</button>
      </div>
    );
  } else {
    body = <Detail data={data} candidateId={candidateId} />;
  }

  return (
    <AppShell title="Candidate profile" back={BACK}>
      {body}
    </AppShell>
  );
}

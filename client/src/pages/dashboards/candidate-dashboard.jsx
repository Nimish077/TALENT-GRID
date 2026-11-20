import { useState } from "react";
import { Card, CardHeader, Badge, EmptyState, PageState, ProgressBar, StatCard } from "../../components/dashboard/primitives.jsx";
import Button from "../../components/ui/button.jsx";
import { useAuth } from "../../context/auth-context.js";
import { applicationsApi, assessmentsApi, candidateApi, jobsApi } from "../../lib/endpoints.js";
import {
  applicationStatusStyle,
  capitalize,
  firstName,
  formatSalaryLpa,
  greeting,
  profileCompleteness,
} from "../../lib/format.js";
import { rankJobs } from "../../lib/dashboard-data.js";
import { useResource } from "../../lib/use-resource.js";

async function loadCandidateDashboard() {
  const [profile, skills, jobs, applications, assessments] = await Promise.all([
    candidateApi.profile(),
    candidateApi.skills(),
    jobsApi.list({ limit: 50 }),
    applicationsApi.mine(),
    assessmentsApi.list({ limit: 1 }),
  ]);
  return {
    profile: profile.profile,
    counts: profile.counts,
    skills: skills.items,
    jobs: jobs.items,
    applications: applications.applications,
    openAssessments: assessments.pagination?.total ?? 0,
  };
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

function SkillChip({ requirement }) {
  const { skill, required_level, verified } = requirement;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${verified ? "border-accent/30 bg-accent-light text-accent-dark" : "border-border bg-surface text-text-primary"}`}>
      {verified && <CheckIcon />}
      {skill.name}
      <span className="text-xs text-text-muted">· {capitalize(required_level)}</span>
    </span>
  );
}

function JobCard({ entry, applied, onApply, error }) {
  const { job, requirements } = entry;
  const [pending, setPending] = useState(false);
  const salary = formatSalaryLpa(job.salary_min, job.salary_max);
  const meta = [job.organization?.name, [job.location, job.work_mode && `(${capitalize(job.work_mode)})`].filter(Boolean).join(" ")].filter(Boolean);

  async function handleApply() {
    setPending(true);
    try {
      await onApply(job.id);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight">{job.title}</h3>
          <p className="mt-1.5 text-sm text-text-secondary">{meta.join(" · ")}</p>
        </div>
        <div className="shrink-0 text-right">
          {salary && <p className="text-sm font-semibold">{salary}</p>}
          {job.experience_level && <p className="mt-0.5 text-xs text-text-muted">{capitalize(job.experience_level)}</p>}
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {requirements.map((req) => <SkillChip key={req.id} requirement={req} />)}
        </div>
        <Button variant="secondary" size="md" className="shrink-0 !bg-brand-light !text-brand hover:!bg-brand/10" disabled={applied || pending} onClick={handleApply}>
          {applied ? "Applied" : pending ? "Applying…" : "Apply"}
        </Button>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-error">{error}</p>}
    </Card>
  );
}

function SkillVerificationPanel({ skills }) {
  const unverified = skills.filter((s) => s.verification_status !== "verified").length;
  return (
    <Card className="p-6">
      <CardHeader title="Skill Verification" />
      {skills.length === 0 ? (
        <EmptyState>No skills yet. Add skills to your profile to start verifying them.</EmptyState>
      ) : (
        <ul className="mt-5 space-y-3.5">
          {skills.map((item) => {
            const verified = item.verification_status === "verified";
            return (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{item.skill.name}</p>
                  <p className="text-xs text-text-muted">{capitalize(verified ? item.verified_level : item.declared_level)}</p>
                </div>
                <Badge className={verified ? "bg-accent-muted text-accent-dark" : "bg-surface-muted text-text-muted"}>
                  {verified ? "✓ Verified" : "Unverified"}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      {unverified > 0 && (
        <Button variant="secondary" size="lg" className="mt-6 w-full !bg-brand-light !text-brand" disabled title="Assessments are coming soon">
          Verify {unverified} {unverified === 1 ? "skill" : "skills"}
        </Button>
      )}
    </Card>
  );
}

function ApplicationsPanel({ applications }) {
  const recent = applications.slice(0, 4);
  return (
    <Card className="p-6">
      <CardHeader title="Applications" />
      {recent.length === 0 ? (
        <EmptyState>You haven&apos;t applied to any jobs yet.</EmptyState>
      ) : (
        <ul className="mt-5 space-y-4">
          {recent.map((app) => (
            <li key={app.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{app.job.title}</p>
                <p className="text-xs text-text-muted">{app.job.organization?.name}</p>
              </div>
              <Badge className={applicationStatusStyle[app.status] ?? "bg-surface-muted text-text-secondary"}>{capitalize(app.status)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CandidateDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useResource(loadCandidateDashboard);
  const [applied, setApplied] = useState(new Set());
  const [applyErrors, setApplyErrors] = useState({});

  async function handleApply(jobId) {
    setApplyErrors((prev) => ({ ...prev, [jobId]: null }));
    try {
      await jobsApi.apply(jobId);
      setApplied((prev) => new Set(prev).add(jobId));
      reload();
    } catch (err) {
      // 409 means we already applied (e.g. in another tab): treat as applied.
      if (err.status === 409) setApplied((prev) => new Set(prev).add(jobId));
      else setApplyErrors((prev) => ({ ...prev, [jobId]: err.message }));
    }
  }

  return (
    <main className="mx-auto max-w-[1210px] px-5 pb-20 pt-10 sm:px-8">
      <PageState loading={loading && !data} error={error} onRetry={reload}>
        {data && <Content data={data} user={user} applied={applied} applyErrors={applyErrors} onApply={handleApply} />}
      </PageState>
    </main>
  );
}

function Content({ data, user, applied, applyErrors, onApply }) {
  const { profile, counts, skills, jobs, applications, openAssessments } = data;
  const completeness = profileCompleteness(profile, counts);
  const verified = skills.filter((s) => s.verification_status === "verified").length;
  const awaiting = skills.length - verified;
  const shortlisted = applications.filter((a) => a.status === "shortlisted").length;
  const appliedIds = new Set([...applied, ...applications.filter((a) => a.status !== "withdrawn").map((a) => a.job_id)]);
  const recommended = rankJobs(jobs, skills).slice(0, 3);

  return (
    <>
      <h1 className="text-[28px] tracking-[-0.03em]">
        {greeting()}, {firstName(user.full_name)} <span aria-hidden="true">👋</span>
      </h1>
      <p className="mt-1.5 text-text-secondary">Here&apos;s what&apos;s happening with your profile today.</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <p className="text-sm text-text-secondary">Profile complete</p>
          <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] text-brand">{completeness.percent}%</p>
          <div className="mt-3"><ProgressBar percent={completeness.percent} label="Profile completeness" /></div>
          <p className="mt-3 text-xs text-text-secondary">{completeness.missing ? `Add ${completeness.missing} to reach 100%` : "Your profile is complete"}</p>
        </Card>
        <StatCard label="Verified skills" value={verified} tone="text-accent-dark" hint={`${awaiting} awaiting assessment`} />
        <StatCard label="Applications" value={applications.length} hint={`${shortlisted} shortlisted`} />
        <StatCard label="Open assessments" value={openAssessments} tone="text-warning" hint="Start verifying skills" />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_468px]">
        <section aria-labelledby="recommended-heading">
          <div className="flex items-center justify-between">
            <h2 id="recommended-heading" className="text-base font-semibold tracking-tight">Recommended Jobs</h2>
          </div>
          <div className="mt-5 space-y-5">
            {recommended.length === 0 ? (
              <Card className="p-6"><EmptyState>No open jobs right now. Check back soon.</EmptyState></Card>
            ) : (
              recommended.map((entry) => (
                <JobCard key={entry.job.id} entry={entry} applied={appliedIds.has(entry.job.id)} onApply={onApply} error={applyErrors[entry.job.id]} />
              ))
            )}
          </div>
        </section>
        <div className="space-y-6">
          <SkillVerificationPanel skills={skills} />
          <ApplicationsPanel applications={applications} />
        </div>
      </div>
    </>
  );
}

export default CandidateDashboard;

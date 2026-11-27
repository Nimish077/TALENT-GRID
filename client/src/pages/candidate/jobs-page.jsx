import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, EmptyState, PageState } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import { applicationsApi, candidateApi, jobsApi } from "../../lib/endpoints.js";
import { capitalize, formatSalaryLpa } from "../../lib/format.js";
import { useResource } from "../../lib/use-resource.js";

function JobRow({ job, applied, onApply, error, mySkills }) {
  const [pending, setPending] = useState(false);
  const salary = formatSalaryLpa(job.salary_min, job.salary_max);
  const meta = [
    job.organization?.name,
    [job.location, job.work_mode && `(${capitalize(job.work_mode)})`].filter(Boolean).join(" "),
    job.employment_type && capitalize(job.employment_type),
  ].filter(Boolean);

  async function handleApply() {
    setPending(true);
    try {
      await onApply(job.id);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{job.title}</h2>
          <p className="mt-1 text-[13px] text-text-secondary">{meta.join(" · ")}</p>
        </div>
        <div className="shrink-0 text-right">
          {salary && <p className="text-[13px] font-semibold">{salary}</p>}
          {job.experience_level && <p className="mt-0.5 text-xs text-text-muted">{capitalize(job.experience_level)}</p>}
        </div>
      </div>
      {job.description && <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{job.description}</p>}
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {(job.skills ?? []).map((req) => {
            const mine = mySkills.get(req.skill_id);
            const status = !mine ? "missing" : mine.verification_status === "verified" ? "verified" : "declared";
            const tone = { verified: "border-accent/40 bg-accent-muted text-accent-dark", declared: "border-border bg-surface text-text-primary", missing: "border-warning/40 bg-warning-light text-warning" }[status];
            return (
              <Badge key={req.id} className={`border font-normal ${tone}`} title={status === "missing" ? "Add this skill to your profile to apply" : undefined}>
                {status === "verified" && "✓ "}{req.skill.name} <span className="ml-1 opacity-70">· {capitalize(req.required_level)}</span>
                {status === "missing" && <span className="ml-1">· not on your profile</span>}
              </Badge>
            );
          })}
        </div>
        <Button size="sm" variant="secondary" className="shrink-0 !bg-brand-light !text-brand hover:!bg-brand/10" disabled={applied || pending} onClick={handleApply}>
          {applied ? "Applied" : pending ? "Applying…" : "Apply"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-error">
          {error} <Link to="/skills" className="font-medium underline">Go to My Skills</Link>
        </p>
      )}
    </Card>
  );
}

function JobsPage() {
  const [filters, setFilters] = useState({ search: "", location: "" });
  const [draft, setDraft] = useState(filters);
  const [applied, setApplied] = useState(() => new Set());
  const [errors, setErrors] = useState({});

  const { data, error, loading, reload } = useResource(async () => {
    const params = { limit: 50, search: filters.search.trim() || undefined, location: filters.location.trim() || undefined };
    const [jobs, mine, skills] = await Promise.all([jobsApi.list(params), applicationsApi.mine(), candidateApi.skills()]);
    return { jobs: jobs.items, applications: mine.applications, skills: skills.items ?? [] };
  });

  function submit(event) {
    event.preventDefault();
    setFilters(draft);
    reload();
  }

  async function handleApply(jobId) {
    setErrors((prev) => ({ ...prev, [jobId]: "" }));
    try {
      await jobsApi.apply(jobId);
      setApplied((prev) => new Set(prev).add(jobId));
    } catch (err) {
      // 409 = already applied: treat it as applied rather than an error.
      if (err.status === 409) setApplied((prev) => new Set(prev).add(jobId));
      else setErrors((prev) => ({ ...prev, [jobId]: err.message }));
    }
  }

  const mySkills = new Map((data?.skills ?? []).map((item) => [item.skill_id ?? item.skill?.id, item]));
  const appliedIds = new Set([...(data?.applications ?? []).filter((a) => a.status !== "withdrawn").map((a) => a.job_id), ...applied]);

  return (
    <AppShell title="Jobs" subtitle="Browse open roles and apply with your verified skills.">
      <form onSubmit={submit} className="flex flex-wrap gap-3" role="search">
        <input aria-label="Search jobs" placeholder="Search title or keyword" value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} className="h-10 min-w-[220px] flex-1 rounded-[var(--radius)] border border-border bg-surface px-3.5 text-sm focus:border-brand focus:outline-none" />
        <input aria-label="Location" placeholder="Location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} className="h-10 w-48 rounded-[var(--radius)] border border-border bg-surface px-3.5 text-sm focus:border-brand focus:outline-none" />
        <Button type="submit">Search</Button>
      </form>

      <div className="mt-6 space-y-4">
        <PageState loading={loading} error={error} onRetry={reload}>
          {data?.jobs.length === 0 ? (
            <Card className="p-5"><EmptyState>No jobs match your search.</EmptyState></Card>
          ) : (
            data?.jobs.map((job) => <JobRow key={job.id} job={job} applied={appliedIds.has(job.id)} onApply={handleApply} error={errors[job.id]} mySkills={mySkills} />)
          )}
        </PageState>
      </div>
    </AppShell>
  );
}

export default JobsPage;

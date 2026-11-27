import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, PageState, PendingNotice } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import FormField from "../../components/ui/form-field.jsx";
import { jobsApi, organizationsApi, skillsApi } from "../../lib/endpoints.js";
import { LEVELS, capitalize } from "../../lib/format.js";
import { buildJobPayload, buildSkillRequirements } from "../../lib/job-form.js";
import { loadEmployerOrganization } from "../../lib/organization.js";
import { useResource } from "../../lib/use-resource.js";

const selectClass = "h-11 w-full rounded-[var(--radius)] border border-border bg-surface px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

async function loadFormData() {
  const org = await loadEmployerOrganization();
  if (!org.canManage) return { ...org, skills: [] };
  const { items } = await skillsApi.list({ limit: 100 });
  return { ...org, skills: items };
}

function Select({ label, children, ...props }) {
  return (
    <label className="block text-sm font-medium text-text-primary">
      <span className="mb-2 block">{label}</span>
      <select className={selectClass} {...props}>{children}</select>
    </label>
  );
}

const emptyForm = {
  title: "", description: "", location: "", workMode: "", employmentType: "",
  experienceLevel: "", salaryMinLpa: "", salaryMaxLpa: "", deadline: "",
};

function PostJobPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useResource(loadFormData);
  const [form, setForm] = useState(emptyForm);
  const [rows, setRows] = useState([{ skillId: "", level: "intermediate" }]);
  const [publish, setPublish] = useState(true);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const setRow = (index, patch) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    const built = buildJobPayload(form);
    if (built.error) return setFormError(built.error);

    setSubmitting(true);
    let job;
    try {
      ({ job } = await organizationsApi.createJob(data.organization.id, built.payload));
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
      return;
    }

    // The job exists now; a later failure leaves it as a draft the user can finish.
    try {
      const requirements = buildSkillRequirements(rows);
      if (requirements.length) await jobsApi.setSkills(job.id, requirements);
      if (publish) await jobsApi.publish(job.id);
      navigate("/employer/jobs", { replace: true });
    } catch (err) {
      setFormError(`Your job was saved as a draft, but we couldn't finish setting it up: ${err.message}`);
      setSubmitting(false);
    }
  }

  return (
    <AppShell back={{ to: "/employer/jobs", label: "Your jobs" }} title="Post a Job" subtitle={data?.organization?.name} width="max-w-3xl">
      <PageState loading={loading} error={error} onRetry={reload}>
        {data?.pending && <PendingNotice kind="organization" suspended={data.suspended} />}
        {data?.canManage && (
          <form onSubmit={handleSubmit}>
            <Card className="space-y-5 p-6">
              {formError && <p role="alert" className="rounded-[var(--radius)] border border-error/30 bg-error-light px-3.5 py-2.5 text-sm text-error">{formError}</p>}
              <FormField label="Job title" required minLength={2} maxLength={200} placeholder="Senior React Developer" value={form.title} onChange={set("title")} />
              <label className="block text-sm font-medium text-text-primary">
                <span className="mb-2 block">Description</span>
                <textarea rows={5} maxLength={20000} value={form.description} onChange={set("description")} className="w-full rounded-[var(--radius)] border border-border bg-surface px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Location" placeholder="Bengaluru" value={form.location} onChange={set("location")} />
                <FormField label="Experience" placeholder="3-6 years" value={form.experienceLevel} onChange={set("experienceLevel")} />
                <Select label="Work mode" value={form.workMode} onChange={set("workMode")}>
                  <option value="">Not specified</option>
                  {["onsite", "hybrid", "remote"].map((v) => <option key={v} value={v}>{capitalize(v)}</option>)}
                </Select>
                <Select label="Employment type" value={form.employmentType} onChange={set("employmentType")}>
                  <option value="">Not specified</option>
                  {["full_time", "part_time", "internship", "contract"].map((v) => <option key={v} value={v}>{capitalize(v)}</option>)}
                </Select>
                <FormField label="Min salary (LPA)" type="number" min="0" step="0.5" value={form.salaryMinLpa} onChange={set("salaryMinLpa")} />
                <FormField label="Max salary (LPA)" type="number" min="0" step="0.5" value={form.salaryMaxLpa} onChange={set("salaryMaxLpa")} />
                <FormField label="Application deadline" type="date" value={form.deadline} onChange={set("deadline")} />
              </div>
            </Card>

            <Card className="mt-5 p-6">
              <h2 className="text-[15px] font-semibold tracking-tight">Required skills</h2>
              <p className="mt-1 text-sm text-text-secondary">Candidates are matched on these skills and their verified level.</p>
              <ul className="mt-4 space-y-3">
                {rows.map((row, index) => (
                  <li key={index} className="flex items-end gap-3">
                    <div className="flex-1">
                      <Select label={index === 0 ? "Skill" : ""} aria-label={`Skill ${index + 1}`} value={row.skillId} onChange={(e) => setRow(index, { skillId: e.target.value })}>
                        <option value="">Select a skill</option>
                        {data.skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}{skill.assessment_id === null ? " (no platform test yet)" : ""}</option>)}
                      </Select>
                    </div>
                    <div className="w-40">
                      <Select label={index === 0 ? "Minimum level" : ""} aria-label={`Level ${index + 1}`} value={row.level} onChange={(e) => setRow(index, { level: e.target.value })}>
                        {LEVELS.map((level) => <option key={level} value={level}>{capitalize(level)}</option>)}
                      </Select>
                    </div>
                    <Button variant="ghost" size="md" aria-label={`Remove skill ${index + 1}`} onClick={() => setRows((prev) => (prev.length === 1 ? [{ skillId: "", level: "intermediate" }] : prev.filter((_, i) => i !== index)))}>✕</Button>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setRows((prev) => [...prev, { skillId: "", level: "intermediate" }])}>+ Add skill</Button>
              {data.skills.length === 0 && <p className="mt-3 text-xs text-text-muted">The skill catalog is empty, so you can post without skills for now.</p>}
            </Card>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="h-4 w-4 accent-brand" />
                Publish immediately
              </label>
              <Button type="submit" size="lg" disabled={submitting}>{submitting ? "Saving…" : publish ? "Post job" : "Save draft"}</Button>
            </div>
          </form>
        )}
      </PageState>
    </AppShell>
  );
}

export default PostJobPage;

import { useEffect, useState } from "react";
import { Badge, Card, CardHeader, EmptyState, PageState, ProgressBar } from "../../components/dashboard/primitives.jsx";
import { levelStyle } from "../../components/assessment/clock.js";
import AppShell from "../../components/layout/app-shell.jsx";
import Button from "../../components/ui/button.jsx";
import FormField from "../../components/ui/form-field.jsx";
import { candidateApi, skillsApi } from "../../lib/endpoints.js";
import { capitalize, LEVELS } from "../../lib/format.js";
import { useResource } from "../../lib/use-resource.js";

const selectClass =
  "h-10 rounded-[var(--radius)] border border-border bg-surface px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

function LevelBadge({ level, verified = false }) {
  return (
    <Badge className={verified ? levelStyle[level] ?? levelStyle.beginner : "bg-surface-muted text-text-secondary"}>
      {capitalize(level)}
    </Badge>
  );
}

function SkillRow({ item, busy, onLevel, onRemove }) {
  const verified = item.verification_status === "verified";
  const [confirming, setConfirming] = useState(false);
  const name = item.skill?.name ?? "Skill";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          {verified ? (
            <>
              <Badge className="bg-accent-muted text-accent-dark">✓ Verified</Badge>
              <LevelBadge level={item.verified_level} verified />
            </>
          ) : (
            <>
              <span>Declared</span>
              <LevelBadge level={item.declared_level} />
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!verified && (
          <>
            <select
              aria-label={`Declared level for ${name}`}
              value={item.declared_level}
              disabled={busy}
              onChange={(e) => onLevel(item.id, e.target.value)}
              className={`${selectClass} !h-9`}
            >
              {LEVELS.map((l) => <option key={l} value={l}>{capitalize(l)}</option>)}
            </select>
            {item.assessment_id === null ? (
              <span className="text-xs text-text-muted" title="No platform test exists for this skill yet">No test available yet</span>
            ) : (
              <Button size="sm" variant="secondary" to="/assessments" className="!bg-brand-light !text-brand">Verify this skill</Button>
            )}
          </>
        )}
        {confirming ? (
          <span role="group" aria-label={`Confirm removing ${name}`} className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">Remove?</span>
            <Button size="sm" variant="outline" className="!border-error !text-error" disabled={busy} onClick={() => onRemove(item.id)}>Yes, remove</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" aria-label={`Remove ${name}`} onClick={() => setConfirming(true)}>Remove</Button>
        )}
      </div>
    </li>
  );
}

function AddSkillCard({ existingIds, onAdd }) {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState([]);
  const [skillId, setSkillId] = useState("");
  const [level, setLevel] = useState("beginner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      skillsApi
        .list({ search: search.trim() || undefined, limit: 50 })
        .then((res) => active && setOptions(res.items ?? []))
        .catch(() => active && setOptions([]));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  const available = options.filter((s) => !existingIds.has(s.id));

  async function submit(event) {
    event.preventDefault();
    if (!skillId) return;
    setBusy(true);
    setError("");
    try {
      await onAdd({ skill_id: skillId, declared_level: level });
      setSkillId("");
      setSearch("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeader title="Add a skill" />
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <FormField label="Search skills" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. React" />
        <div>
          <label htmlFor="skill-pick" className="mb-1.5 block text-[13px] font-medium">Skill</label>
          <select id="skill-pick" value={skillId} onChange={(e) => setSkillId(e.target.value)} className={`${selectClass} w-full`}>
            <option value="">{available.length ? "Choose a skill" : "No matching skills"}</option>
            {available.map((s) => <option key={s.id} value={s.id}>{s.name}{s.assessment_id ? " · test available" : ""}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="skill-level" className="mb-1.5 block text-[13px] font-medium">Your level</label>
          <select id="skill-level" value={level} onChange={(e) => setLevel(e.target.value)} className={`${selectClass} w-full`}>
            {LEVELS.map((l) => <option key={l} value={l}>{capitalize(l)}</option>)}
          </select>
        </div>
        <Button type="submit" disabled={!skillId || busy}>{busy ? "Adding…" : "Add skill"}</Button>
      </form>
      {error && <p role="alert" className="mt-3 text-xs text-error">{error}</p>}
    </Card>
  );
}

function ProfileCard({ profile }) {
  const [form, setForm] = useState({ headline: profile?.headline ?? "", location: profile?.location ?? "", bio: profile?.bio ?? "" });
  const [status, setStatus] = useState({ kind: "idle", message: "" });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event) {
    event.preventDefault();
    setStatus({ kind: "saving", message: "" });
    try {
      await candidateApi.updateProfile({ headline: form.headline.trim(), location: form.location.trim(), bio: form.bio.trim() });
      setStatus({ kind: "saved", message: "Profile saved." });
    } catch (err) {
      setStatus({ kind: "error", message: err.message });
    }
  }

  return (
    <Card className="p-5">
      <CardHeader title="Profile" />
      <form onSubmit={submit} className="mt-3 space-y-3">
        <FormField label="Headline" value={form.headline} onChange={set("headline")} maxLength={160} placeholder="Full-stack developer" />
        <FormField label="Location" value={form.location} onChange={set("location")} maxLength={120} placeholder="Bengaluru" />
        <div>
          <label htmlFor="profile-bio" className="mb-1.5 block text-[13px] font-medium">Bio</label>
          <textarea id="profile-bio" rows={4} value={form.bio} onChange={set("bio")} maxLength={2000} className="w-full rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={status.kind === "saving"}>{status.kind === "saving" ? "Saving…" : "Save profile"}</Button>
          <p role="status" aria-live="polite" className={`text-xs ${status.kind === "error" ? "text-error" : "text-accent-dark"}`}>{status.message}</p>
        </div>
      </form>
    </Card>
  );
}

function SkillsPage() {
  const { data, error, loading, reload } = useResource(async () => {
    const [skills, profile] = await Promise.all([candidateApi.skills(), candidateApi.profile()]);
    return { skills: skills.items ?? [], profile: profile.profile ?? null };
  });
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function run(id, action) {
    setBusyId(id);
    setActionError("");
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const skills = data?.skills ?? [];
  const verified = skills.filter((s) => s.verification_status === "verified");
  const unverified = skills.filter((s) => s.verification_status !== "verified");
  const percent = skills.length ? Math.round((verified.length / skills.length) * 100) : 0;

  const renderList = (items) => (
    <ul className="mt-2 divide-y divide-border">
      {items.map((item) => (
        <SkillRow key={item.id} item={item} busy={busyId === item.id} onLevel={(id, lvl) => run(id, () => candidateApi.updateSkill(id, lvl))} onRemove={(id) => run(id, () => candidateApi.removeSkill(id))} />
      ))}
    </ul>
  );

  return (
    <AppShell title="My Skills" subtitle="Declare your skills, then verify them with a graded assessment.">
      <PageState loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <div className="space-y-5">
            {actionError && <p role="alert" className="text-sm text-error">{actionError}</p>}
            <Card className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-semibold">{verified.length} of {skills.length} skills verified</p>
                <span className="text-xs text-text-secondary">{percent}%</span>
              </div>
              <div className="mt-3"><ProgressBar percent={percent} color="bg-accent" label="Skills verified" /></div>
              <p className="mt-3 text-xs text-text-secondary">
                Verified levels come from a graded assessment and cannot be edited. Only the level you declare for an unverified skill can be changed.
              </p>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="p-5">
                <CardHeader title={`Verified (${verified.length})`} />
                {verified.length ? renderList(verified) : <EmptyState>No verified skills yet. Take an assessment to earn your first.</EmptyState>}
              </Card>
              <Card className="p-5">
                <CardHeader title={`Not yet verified (${unverified.length})`} />
                {unverified.length ? renderList(unverified) : <EmptyState>{skills.length ? "Everything is verified." : "You have not added any skills yet."}</EmptyState>}
              </Card>
            </div>

            <AddSkillCard existingIds={new Set(skills.map((s) => s.skill?.id))} onAdd={async (body) => { await candidateApi.addSkill(body); reload(); }} />
            <ProfileCard profile={data.profile} />
          </div>
        )}
      </PageState>
    </AppShell>
  );
}

export default SkillsPage;

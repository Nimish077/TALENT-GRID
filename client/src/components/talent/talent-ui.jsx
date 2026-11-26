import { useEffect, useRef, useState } from "react";
import { jobsApi, organizationsApi } from "../../lib/endpoints.js";
import { capitalize, initials } from "../../lib/format.js";

export function Avatar({ name, src, size = "h-11 w-11 text-sm" }) {
  return src ? (
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span aria-hidden="true" className={`${size} flex shrink-0 items-center justify-center rounded-full bg-brand-light font-semibold text-brand`}>
      {initials(name) || "?"}
    </span>
  );
}

function matchTier(percent) {
  if (percent === null || percent === undefined) return { label: "n/a", cls: "bg-surface-muted text-text-secondary" };
  if (percent >= 80) return { label: `${percent}%`, cls: "bg-accent-muted text-accent-dark" };
  if (percent >= 50) return { label: `${percent}%`, cls: "bg-warning-light text-warning" };
  return { label: `${percent}%`, cls: "bg-surface-muted text-text-secondary" };
}

export function MatchBadge({ percent }) {
  const tier = matchTier(percent);
  return (
    <div
      className={`flex min-w-[72px] flex-col items-center rounded-lg px-3 py-2 ${tier.cls}`}
      aria-label={percent == null ? "No match score" : `${percent} percent match`}
    >
      <span className="text-lg font-semibold leading-none">{tier.label}</span>
      <span className="mt-1 text-[11px] font-medium">{percent == null ? "no requirements" : "verified match"}</span>
    </div>
  );
}

export function VerifiedChip({ children, level }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-muted px-2.5 py-1 text-xs font-medium text-accent-dark">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 12 5 5 9-10" />
      </svg>
      {children}
      {level && <span className="font-normal opacity-80">· {capitalize(level)}</span>}
    </span>
  );
}

export function GapChip({ gap }) {
  const label = gap.status === "claimed" ? "claimed, not verified" : "no evidence";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 py-1 text-xs text-text-secondary">
      {gap.name} <span className="text-text-muted">· {capitalize(gap.required_level)}+ · {label}</span>
    </span>
  );
}

// Dropdown of the employer's published jobs; choosing one sends an invitation.
export function InviteControl({ candidateProfileId, align = "right" }) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onDown = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  async function loadJobs() {
    setLoadError(null);
    try {
      const { memberships } = await organizationsApi.mine();
      const membership = memberships.find((m) => m.status === "active") ?? memberships[0];
      if (!membership) {
        setJobs([]);
        return;
      }
      const { jobs: all } = await organizationsApi.jobs(membership.organization.id);
      setJobs(all.filter((job) => job.status === "published"));
    } catch (error) {
      setLoadError(error.message);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && jobs === null) loadJobs();
  }

  async function invite(job) {
    setSending(true);
    setOpen(false);
    try {
      await jobsApi.invite(job.id, candidateProfileId);
      setResult({ ok: true, message: `Invited to ${job.title}` });
    } catch (error) {
      setResult({
        ok: false,
        message: error.status === 409 ? "Already applied or invited to this job." : error.message || "Could not send the invitation.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={sending}
        className="inline-flex h-9 items-center justify-center rounded-[var(--radius)] bg-brand px-3 text-sm font-medium text-surface transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
      >
        {sending ? "Inviting…" : "Invite to job"}
      </button>
      {open && (
        <div role="menu" aria-label="Choose a job" className={`absolute z-20 mt-1 w-64 rounded-xl border border-border bg-surface p-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}>
          {loadError ? (
            <p role="alert" className="px-3 py-2 text-xs text-error">{loadError}</p>
          ) : jobs === null ? (
            <p role="status" className="px-3 py-2 text-xs text-text-secondary">Loading jobs…</p>
          ) : jobs.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-secondary">No published jobs yet. Publish a job to invite candidates.</p>
          ) : (
            jobs.map((job) => (
              <button key={job.id} type="button" role="menuitem" onClick={() => invite(job)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none">
                {job.title}
              </button>
            ))
          )}
        </div>
      )}
      {result && (
        <p role="status" className={`mt-1.5 text-xs ${result.ok ? "text-accent-dark" : "text-error"}`}>{result.message}</p>
      )}
    </div>
  );
}

import { BriefcaseIcon, CircleCheckIcon, PinIcon } from "./landing-primitives.jsx";

const previewSkills = [
  ["React", "Advanced", "91%"],
  ["Node.js", "Intermediate", "84%"],
  ["PostgreSQL", "Intermediate", "79%"],
  ["TypeScript", "Intermediate", "Unverified"],
];

function ProfilePreview() {
  return (
    <article className="w-full max-w-[390px] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
      <header className="flex items-start gap-3 border-b border-border bg-surface-muted px-5 py-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-light font-semibold text-brand">AS</span>
        <div className="min-w-0">
          <p className="font-semibold text-text-primary">Arjun Sharma</p>
          <p className="text-sm text-text-secondary">Full Stack Developer</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted"><PinIcon />Bengaluru, India<span aria-hidden="true">&middot;</span><BriefcaseIcon />4 yr exp</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap rounded bg-accent-muted px-2 py-1 text-xs font-medium text-accent-dark"><CircleCheckIcon size={12} />4 Verified</span>
      </header>
      <div className="px-5 py-4">
        <p className="mb-3 text-[10px] font-semibold tracking-wide text-text-muted">SKILLS</p>
        <div className="space-y-2">
          {previewSkills.map(([skill, level, score]) => (
            <div key={skill} className="flex items-center text-sm">
              <span className="font-medium text-text-primary">{skill}</span>
              <span className="ml-2 text-xs text-text-muted">{level}</span>
              {score === "Unverified" ? <span className="ml-auto text-xs text-text-muted">Unverified</span> : <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent-dark"><CircleCheckIcon size={13} />{score}</span>}
            </div>
          ))}
        </div>
      </div>
      <footer className="border-t border-border px-5 py-3">
        <div className="mb-2 flex justify-between text-xs text-text-muted"><span>Profile completeness</span><span className="text-brand">88%</span></div>
        <div className="h-1.5 rounded-full bg-border"><div className="h-full w-[88%] rounded-full bg-brand" /></div>
      </footer>
    </article>
  );
}

export default ProfilePreview;

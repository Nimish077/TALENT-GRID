import Button from "../components/ui/button.jsx";
import logo from "../assets/TalentGrid-Logo (2).svg";

const steps = [
  {
    number: "01",
    title: "Build your profile",
    description: "Showcase your experience, skills, projects, and career goals in a structured professional profile.",
  },
  {
    number: "02",
    title: "Verify your skills",
    description: "Demonstrate your ability through structured assessments and earn verified skill credentials.",
  },
  {
    number: "03",
    title: "Connect with opportunity",
    description: "Get discovered by employers looking for demonstrated capabilities, not just claimed experience.",
  },
];

const skills = [
  ["JavaScript", "Intermediate", "86%"],
  ["Python", "Advanced", "94%"],
  ["React", "Advanced", "91%"],
  ["Node.js", "Intermediate", "84%"],
  ["SQL", "Intermediate", "79%"],
  ["Machine Learning", "Beginner", "72%"],
];

const audiences = [
  {
    id: "candidates",
    name: "Candidates",
    title: "Turn your skills into opportunities.",
    points: ["Build a verified skill portfolio", "Take structured assessments", "Get matched to relevant roles"],
    tone: "border-brand text-brand bg-brand-light",
  },
  {
    id: "employers",
    name: "Employers",
    title: "Find people who can actually do the work.",
    points: ["Filter by verified skills", "See assessment evidence", "Hire with confidence"],
    tone: "border-accent text-accent bg-accent-light",
  },
  {
    id: "institutes",
    name: "Institutes",
    title: "Turn education into employability.",
    points: ["Track student skill development", "Conduct and manage assessments", "Connect students to employers"],
    tone: "border-warning text-warning bg-warning-light",
  },
];

function ArrowIcon() {
  return <span aria-hidden="true" className="ml-1 text-lg leading-none">→</span>;
}

function CheckIcon() {
  return (
    <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-bold text-accent">
      ✓
    </span>
  );
}

function HeroProfile() {
  const previewSkills = [
    ["React", "Advanced", "91%"],
    ["Node.js", "Intermediate", "84%"],
    ["PostgreSQL", "Intermediate", "79%"],
    ["TypeScript", "Intermediate", "Unverified"],
  ];

  return (
    <article className="w-full max-w-[390px] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
      <header className="flex items-start gap-3 border-b border-border bg-surface-muted px-5 py-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-light font-semibold text-brand">AS</span>
        <div className="min-w-0">
          <p className="font-semibold text-text-primary">Nimish Upadhyay</p>
          <p className="text-sm text-text-secondary">Full Stack Developer</p>
          <p className="mt-1 text-xs text-text-muted">⌾ Bengaluru, India &nbsp;·&nbsp; ▣ 4 yr exp</p>
        </div>
        <span className="ml-auto whitespace-nowrap rounded bg-accent-muted px-2 py-1 text-xs font-medium text-accent">✓ 4 Verified</span>
      </header>
      <div className="px-5 py-4">
        <p className="mb-3 text-[10px] font-semibold tracking-wide text-text-muted">SKILLS</p>
        <div className="space-y-2">
          {previewSkills.map(([skill, level, score]) => (
            <div key={skill} className="flex items-center text-sm">
              <span className="font-medium text-text-primary">{skill}</span>
              <span className="ml-2 text-xs text-text-muted">{level}</span>
              <span className="ml-auto text-xs font-medium text-accent">{score === "Unverified" ? score : `⊙ ${score}`}</span>
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

function Landing() {
  return (
    <main id="top">
      <section className="mx-auto grid min-h-[620px] max-w-[1280px] items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.75fr] lg:py-28">
        <div className="max-w-[620px]">
          <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary"><span className="h-2 w-2 rounded-full bg-accent" />Verified skills. Real opportunity.</p>
          <h1 className="mt-7 max-w-[590px] text-4xl font-bold leading-[1.14] tracking-[-0.04em] text-text-primary sm:text-5xl lg:text-[52px]">Your skills should speak louder than your resume.</h1>
          <p className="mt-6 max-w-[570px] text-lg leading-7 text-text-secondary">TalentGrid connects skilled candidates with employers through verified skills, structured assessments, and meaningful opportunities.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg">Find Opportunities <ArrowIcon /></Button>
            <Button variant="outline" size="lg">Hire Verified Talent</Button>
          </div>
          <div className="mt-10 grid max-w-[590px] grid-cols-3 border-t border-border pt-7">
            {[["12K+", "Verified candidates"], ["3.4K+", "Employers hiring"], ["98K+", "Skills verified"]].map(([value, label]) => (
              <div key={label}><p className="text-xl font-bold text-text-primary">{value}</p><p className="mt-1 text-xs text-text-muted">{label}</p></div>
            ))}
          </div>
        </div>
        <div className="justify-self-center lg:justify-self-end"><HeroProfile /></div>
      </section>

      <section id="how-it-works" className="border-y border-border bg-surface-muted px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-[1280px]">
          <div className="text-center"><p className="text-xs font-semibold tracking-[0.12em] text-brand">HOW IT WORKS</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">From skills to opportunity in three steps</h2></div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step) => <article key={step.number} className="rounded-lg border border-border bg-surface p-6"><span className="text-2xl font-semibold text-brand-light">{step.number}</span><h3 className="mt-6 text-lg font-semibold">{step.title}</h3><p className="mt-3 leading-6 text-text-secondary">{step.description}</p></article>)}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-24">
        <div><p className="text-xs font-semibold tracking-[0.12em] text-accent">SKILL VERIFICATION</p><h2 className="mt-3 max-w-[470px] text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">Skills you can prove, not just claim.</h2><p className="mt-5 max-w-[530px] text-lg leading-7 text-text-secondary">Every skill on TalentGrid is backed by a structured assessment. Employers see exactly what a candidate can do — with scores, levels, and verified evidence.</p><ul className="mt-8 space-y-3">{["Structured, role-relevant assessments", "Transparent scoring and thresholds", "Shareable verified credentials", "Skill-level progression: Beginner → Advanced"].map((point) => <li key={point} className="flex items-center gap-3 text-text-secondary"><CheckIcon />{point}</li>)}</ul></div>
        <div className="grid gap-3 sm:grid-cols-2">{skills.map(([skill, level, score]) => <article key={skill} className="rounded-lg border border-border bg-surface p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{skill}</h3><p className="text-sm text-text-muted">{level}</p></div><span className="rounded bg-accent-muted px-2 py-1 text-xs font-medium text-accent">⊙ Verified</span></div><div className="mt-4 flex justify-between text-xs text-text-muted"><span>Assessment score</span><span className="text-sm font-semibold text-accent">{score}</span></div><div className="mt-2 h-1.5 rounded-full bg-border"><div className="h-full rounded-full bg-accent" style={{ width: score }} /></div></article>)}</div>
      </section>

      <section className="border-y border-border bg-surface-muted px-5 py-20 sm:px-8 lg:py-24"><div className="mx-auto max-w-[1280px]"><h2 className="text-center text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">One platform. Three experiences.</h2><div className="mt-12 grid gap-6 lg:grid-cols-3">{audiences.map((audience) => <article id={audience.id} key={audience.name} className={`rounded-lg border bg-surface p-6 ${audience.tone.split(" ")[0]}`}><span className={`inline-flex rounded px-2.5 py-1 text-xs font-medium ${audience.tone.split(" ").slice(1).join(" ")}`}>{audience.name}</span><h3 className="mt-5 text-xl font-semibold leading-7">{audience.title}</h3><ul className="mt-4 space-y-2.5 text-text-secondary">{audience.points.map((point) => <li key={point}>→ &nbsp;{point}</li>)}</ul><button type="button" className={`mt-6 inline-flex items-center font-medium ${audience.tone.split(" ")[1]}`}>Get started <ArrowIcon /></button></article>)}</div></div></section>

      <section className="px-5 py-24 text-center sm:px-8"><h2 className="mx-auto max-w-[640px] text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">Build talent. Prove skills. Create opportunities.</h2><p className="mt-6 text-lg text-text-secondary">Join thousands of candidates, employers, and institutes on TalentGrid.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button size="lg">Create your account <ArrowIcon /></Button><Button size="lg" variant="outline">Sign in</Button></div></section>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 py-7 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8"><div className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7" /><span className="font-semibold text-text-primary">TalentGrid</span></div><p className="text-text-muted">© 2025 TalentGrid. Verified skills platform.</p></div></footer>
    </main>
  );
}

export default Landing;

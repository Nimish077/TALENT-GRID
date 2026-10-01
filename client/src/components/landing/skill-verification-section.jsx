import { CheckIcon } from "./landing-primitives.jsx";

const skills = [["JavaScript", "Intermediate", "86%"], ["Python", "Advanced", "94%"], ["React", "Advanced", "91%"], ["Node.js", "Intermediate", "84%"], ["SQL", "Intermediate", "79%"], ["Machine Learning", "Beginner", "72%"]];
const benefits = ["Structured, role-relevant assessments", "Transparent scoring and thresholds", "Shareable verified credentials", "Skill-level progression: Beginner to Advanced"];

function SkillCard({ skill, level, score }) {
  return <article className="rounded-lg border border-border bg-surface p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{skill}</h3><p className="text-sm text-text-muted">{level}</p></div><span className="rounded bg-accent-muted px-2 py-1 text-xs font-medium text-accent">Verified</span></div><div className="mt-4 flex justify-between text-xs text-text-muted"><span>Assessment score</span><span className="text-sm font-semibold text-accent">{score}</span></div><div className="mt-2 h-1.5 rounded-full bg-border"><div className="h-full rounded-full bg-accent" style={{ width: score }} /></div></article>;
}

function SkillVerificationSection() {
  return (
    <section className="mx-auto grid max-w-[1280px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:py-24">
      <div><p className="text-xs font-semibold tracking-[0.12em] text-accent">SKILL VERIFICATION</p><h2 className="mt-3 max-w-[470px] text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">Skills you can prove, not just claim.</h2><p className="mt-5 max-w-[530px] text-lg leading-7 text-text-secondary">Every skill on TalentGrid is backed by a structured assessment. Employers see exactly what a candidate can do with scores, levels, and verified evidence.</p><ul className="mt-8 space-y-3">{benefits.map((benefit) => <li key={benefit} className="flex items-center gap-3 text-text-secondary"><CheckIcon />{benefit}</li>)}</ul></div>
      <div className="grid gap-3 sm:grid-cols-2">{skills.map(([skill, level, score]) => <SkillCard key={skill} skill={skill} level={level} score={score} />)}</div>
    </section>
  );
}

export default SkillVerificationSection;

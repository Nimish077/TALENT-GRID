import { ArrowIcon, SectionHeading } from "./landing-primitives.jsx";

const audiences = [
  { id: "candidates", name: "Candidates", title: "Turn your skills into opportunities.", points: ["Build a verified skill portfolio", "Take structured assessments", "Get matched to relevant roles"], borderClass: "border-brand", badgeClass: "bg-brand-light text-brand", actionClass: "text-brand" },
  { id: "employers", name: "Employers", title: "Find people who can actually do the work.", points: ["Filter by verified skills", "See assessment evidence", "Hire with confidence"], borderClass: "border-accent", badgeClass: "bg-accent-light text-accent", actionClass: "text-accent" },
  { id: "institutes", name: "Institutes", title: "Turn education into employability.", points: ["Track student skill development", "Conduct and manage assessments", "Connect students to employers"], borderClass: "border-warning", badgeClass: "bg-warning-light text-warning", actionClass: "text-warning" },
];

function AudienceCard({ audience }) {
  const { id, name, title, points, borderClass, badgeClass, actionClass } = audience;
  return <article id={id} className={`rounded-lg border bg-surface p-6 ${borderClass}`}><span className={`inline-flex rounded px-2.5 py-1 text-xs font-medium ${badgeClass}`}>{name}</span><h3 className="mt-5 text-xl font-semibold leading-7">{title}</h3><ul className="mt-4 space-y-2.5 text-text-secondary">{points.map((point) => <li key={point}>&rarr; &nbsp;{point}</li>)}</ul><button type="button" className={`mt-6 inline-flex items-center font-medium ${actionClass}`}>Get started <ArrowIcon /></button></article>;
}

function AudienceSection() {
  return <section className="border-y border-border bg-surface-muted px-5 py-20 sm:px-8 lg:py-24"><div className="mx-auto max-w-[1280px]"><SectionHeading title="One platform. Three experiences." /><div className="mt-12 grid gap-6 lg:grid-cols-3">{audiences.map((audience) => <AudienceCard key={audience.name} audience={audience} />)}</div></div></section>;
}

export default AudienceSection;

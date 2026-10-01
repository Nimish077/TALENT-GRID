import { SectionHeading } from "./landing-primitives.jsx";

const steps = [
  { number: "01", title: "Build your profile", description: "Showcase your experience, skills, projects, and career goals in a structured professional profile." },
  { number: "02", title: "Verify your skills", description: "Demonstrate your ability through structured assessments and earn verified skill credentials." },
  { number: "03", title: "Connect with opportunity", description: "Get discovered by employers looking for demonstrated capabilities, not just claimed experience." },
];

function StepCard({ number, title, description }) {
  return <article className="rounded-lg border border-border bg-surface p-6"><span className="text-2xl font-semibold text-brand-light">{number}</span><h3 className="mt-6 text-lg font-semibold">{title}</h3><p className="mt-3 leading-6 text-text-secondary">{description}</p></article>;
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-y border-border bg-surface-muted px-5 py-20 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading eyebrow="HOW IT WORKS" title="From skills to opportunity in three steps" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">{steps.map((step) => <StepCard key={step.number} {...step} />)}</div>
      </div>
    </section>
  );
}

export default HowItWorksSection;

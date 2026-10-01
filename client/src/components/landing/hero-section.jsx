import Button from "../ui/button.jsx";
import ProfilePreview from "./profile-preview.jsx";
import { ArrowIcon } from "./landing-primitives.jsx";

const platformStats = [["12K+", "Verified candidates"], ["3.4K+", "Employers hiring"], ["98K+", "Skills verified"]];

function HeroSection() {
  return (
    <section className="mx-auto grid min-h-[620px] max-w-[1280px] items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.75fr] lg:py-28">
      <div className="max-w-[620px]">
        <p className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary"><span className="h-2 w-2 rounded-full bg-accent" />Verified skills. Real opportunity.</p>
        <h1 className="mt-7 max-w-[590px] text-4xl font-bold leading-[1.14] tracking-[-0.04em] text-text-primary sm:text-5xl lg:text-[52px]">Your skills should speak louder than your resume.</h1>
        <p className="mt-6 max-w-[570px] text-lg leading-7 text-text-secondary">TalentGrid connects skilled candidates with employers through verified skills, structured assessments, and meaningful opportunities.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Button size="lg">Find Opportunities <ArrowIcon /></Button><Button variant="outline" size="lg">Hire Verified Talent</Button></div>
        <div className="mt-10 grid max-w-[590px] grid-cols-3 border-t border-border pt-7">
          {platformStats.map(([value, label]) => <div key={label}><p className="text-xl font-bold text-text-primary">{value}</p><p className="mt-1 text-xs text-text-muted">{label}</p></div>)}
        </div>
      </div>
      <div className="justify-self-center lg:justify-self-end"><ProfilePreview /></div>
    </section>
  );
}

export default HeroSection;

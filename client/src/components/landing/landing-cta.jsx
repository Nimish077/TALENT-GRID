import Button from "../ui/button.jsx";
import { ArrowIcon } from "./landing-primitives.jsx";

function LandingCta() {
  return <section className="px-5 py-24 text-center sm:px-8"><h2 className="mx-auto max-w-[640px] text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">Build talent. Prove skills. Create opportunities.</h2><p className="mt-6 text-lg text-text-secondary">Join thousands of candidates, employers, and institutes on TalentGrid.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button size="lg">Create your account <ArrowIcon /></Button><Button size="lg" variant="outline">Sign in</Button></div></section>;
}

export default LandingCta;

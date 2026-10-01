import AudienceSection from "./audience-section.jsx";
import HeroSection from "./hero-section.jsx";
import HowItWorksSection from "./how-it-works-section.jsx";
import LandingCta from "./landing-cta.jsx";
import LandingFooter from "./landing-footer.jsx";
import SkillVerificationSection from "./skill-verification-section.jsx";

function LandingPage() {
  return (
    <main id="top">
      <HeroSection />
      <HowItWorksSection />
      <SkillVerificationSection />
      <AudienceSection />
      <LandingCta />
      <LandingFooter />
    </main>
  );
}

export default LandingPage;

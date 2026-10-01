import Button from "../ui/button.jsx";
import logo from "../../assets/TalentGrid-Logo (2).svg";

const navigationLinks = [
  {
    label: "Candidates",
    to: "#candidates",
  },
  {
    label: "Employers",
    to: "#employers",
  },
  {
    label: "Institutes",
    to: "#institutes",
  },
  {
    label: "How It Works",
    to: "#how-it-works",
  },
];

function TalentGridLogo() {
  return (
    <a
      href="#top"
      className="flex items-center gap-2.5"
      aria-label="TalentGrid home"
    >
      <img src={logo} alt="" className="h-8 w-8" />

      <span className="text-[17px] font-semibold tracking-tight text-text-primary">
        TalentGrid
      </span>
    </a>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-[1280px] items-center px-5 sm:px-8">
        {/* Brand */}
        <TalentGridLogo />

        {/* Navigation */}
        <div className="ml-10 hidden items-center gap-7 md:flex">
          {navigationLinks.map((link) => (
            <a
              key={link.to}
              href={link.to}
              className="text-sm font-normal text-text-secondary transition-colors hover:text-text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="sm">
            Log In
          </Button>

          <Button variant="primary" size="sm">
            Get Started
          </Button>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;

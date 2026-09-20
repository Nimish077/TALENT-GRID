import { Link } from "react-router-dom";
import Button from "../ui/button.jsx";

const navigationLinks = [
  {
    label: "Candidates",
    to: "/candidates",
  },
  {
    label: "Employers",
    to: "/employers",
  },
  {
    label: "Institutes",
    to: "/institutes",
  },
  {
    label: "How It Works",
    to: "/how-it-works",
  },
];

function TalentGridLogo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5"
      aria-label="TalentGrid home"
    >
      <div
        className="grid h-8 w-8 grid-cols-2 gap-1 rounded-[var(--radius)] bg-brand p-1.5"
        aria-hidden="true"
      >
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
        <span className="rounded-[2px] bg-white" />
      </div>

      <span className="text-[17px] font-semibold tracking-tight text-text-primary">
        TalentGrid
      </span>
    </Link>
  );
}

function Navbar() {
  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex h-[70px] max-w-7xl items-center px-6">
        {/* Brand */}
        <TalentGridLogo />

        {/* Navigation */}
        <div className="ml-12 flex items-center gap-8">
          {navigationLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-normal text-text-secondary transition-colors hover:text-text-primary"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-4">
          <Button
            to="/login"
            variant="ghost"
            size="sm"
          >
            Log In
          </Button>

          <Button
            to="/register"
            variant="primary"
            size="sm"
          >
            Get Started
          </Button>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
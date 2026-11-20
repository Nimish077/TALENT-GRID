import { Link, useNavigate } from "react-router-dom";
import logo from "../../assets/TalentGrid-Logo.svg";
import { useAuth } from "../../context/auth-context.js";
import { initials } from "../../lib/format.js";

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-[70px] max-w-[1370px] items-center gap-4 px-5 sm:px-8">
        <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="TalentGrid dashboard">
          <img src={logo} alt="" className="h-8 w-8" />
          <span className="text-[17px] font-semibold tracking-tight">TalentGrid</span>
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <button type="button" aria-label="Notifications" className="rounded-full p-2 text-text-secondary hover:bg-surface-muted">
            <BellIcon />
          </button>
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand">
            {initials(user?.full_name)}
          </span>
          <button type="button" onClick={handleLogout} className="text-sm font-medium text-text-secondary hover:text-text-primary">
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;

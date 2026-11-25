import { useEffect, useRef, useState } from "react";
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

// The API has no notifications feed yet, so the menu honestly says so rather
// than being a dead button.
function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full p-2 text-text-secondary hover:bg-surface-muted"
      >
        <BellIcon />
      </button>
      {open && (
        <div role="status" className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-border bg-surface p-4 text-sm shadow-lg">
          <p className="font-semibold">Notifications</p>
          <p className="mt-1 text-text-secondary">You&apos;re all caught up.</p>
        </div>
      )}
    </div>
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
      <div className="flex h-14 items-center gap-4 px-5 sm:px-6">
        <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="TalentGrid dashboard">
          <img src={logo} alt="" className="h-8 w-8" />
          <span className="text-[17px] font-semibold tracking-tight">TalentGrid</span>
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <NotificationsMenu />
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">
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

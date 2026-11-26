import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/TalentGrid-Logo.svg";
import { useAuth } from "../../context/auth-context.js";
import { initials } from "../../lib/format.js";
import { activeNavItem, pageTitle, portalFor } from "../../lib/navigation.js";
import NavIcon from "./nav-icons.jsx";
import NotificationsMenu from "./notifications-menu.jsx";

function Sidebar({ user, onNavigate, onLogout }) {
  const { pathname } = useLocation();
  const portal = portalFor(user.role);
  const active = activeNavItem(portal.items, pathname);

  return (
    <div className="flex h-full flex-col">
      <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5 border-b border-border px-5 py-4" aria-label="TalentGrid dashboard">
        <img src={logo} alt="" className="h-8 w-8" />
        <span>
          <span className="block text-sm font-bold leading-tight text-text-primary">TalentGrid</span>
          <span className="mt-0.5 block text-[10px] leading-none text-text-muted">{portal.label}</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {portal.items.map((item) => {
          const isActive = item === active;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-light text-brand" : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              }`}
            >
              <span className={isActive ? "text-brand" : "text-text-muted"}>
                <NavIcon name={item.icon} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-4">
        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] px-2 py-2">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">
            {initials(user.full_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{user.full_name}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
            className="rounded p-1.5 text-text-muted transition-colors hover:bg-error-light hover:text-error"
          >
            <NavIcon name="logout" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// App frame for every signed-in page: sidebar (drawer on small screens), a slim
// top bar, and the routed page in the scrolling content area.
function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.title = pageTitle(user.role, pathname);
  }, [user.role, pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <a href="#content" className="sr-only z-50 rounded bg-surface px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:left-3 focus:top-3">
        Skip to content
      </a>

      <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:block">
        <Sidebar user={user} onLogout={handleLogout} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-surface shadow-xl">
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded p-1 text-text-secondary hover:text-text-primary">
              <NavIcon name="close" size={20} />
            </button>
            <Sidebar user={user} onNavigate={() => setDrawerOpen(false)} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-4 md:px-6">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="rounded p-1.5 text-text-secondary hover:text-text-primary md:hidden">
            <NavIcon name="menu" size={20} />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <NotificationsMenu />
            <div className="hidden items-center gap-2 border-l border-border pl-3 md:flex">
              <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">
                {initials(user.full_name)}
              </span>
              <span className="text-sm font-medium text-text-primary">{user.full_name}</span>
            </div>
          </div>
        </header>

        <div id="content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default PortalLayout;

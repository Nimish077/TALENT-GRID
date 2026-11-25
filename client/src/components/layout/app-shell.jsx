import { Link } from "react-router-dom";
import AppHeader from "./app-header.jsx";

// Frame for inner pages: header, a "back to dashboard" link, title and body.
function AppShell({ title, subtitle, action, children, width = "max-w-5xl" }) {
  return (
    <div className="min-h-screen bg-bg">
      <AppHeader />
      <main className={`mx-auto ${width} px-5 pb-16 pt-8 sm:px-8`}>
        <Link to="/dashboard" className="text-sm text-text-secondary hover:text-text-primary">← Dashboard</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] tracking-[-0.03em]">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
          </div>
          {action}
        </div>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

export default AppShell;

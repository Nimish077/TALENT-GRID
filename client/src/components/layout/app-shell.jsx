import { Link } from "react-router-dom";

// Page frame inside the portal layout: optional back link, title, subtitle and
// a primary action. The sidebar and top bar come from <PortalLayout />.
function AppShell({ title, subtitle, action, back, children, width = "max-w-5xl" }) {
  return (
    <main className={`mx-auto ${width} px-5 pb-16 pt-8 sm:px-8`}>
      {back && (
        <Link to={back.to} className="mb-3 inline-block text-sm text-text-secondary hover:text-text-primary">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] tracking-[-0.03em]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </main>
  );
}

export default AppShell;

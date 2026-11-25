export function Card({ children, className = "", ...props }) {
  return (
    <section className={`rounded-xl border border-border bg-surface ${className}`} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "text-text-primary", icon, iconTone = "bg-brand-light text-brand" }) {
  return (
    <Card className="p-5">
      {icon ? (
        <span aria-hidden="true" className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${iconTone}`}>{icon}</span>
      ) : (
        <p className="text-[13px] text-text-secondary">{label}</p>
      )}
      <p className={`${icon ? "" : "mt-2 "}text-[26px] font-semibold leading-none tracking-[-0.03em] ${tone}`}>{value}</p>
      {icon && <p className="mt-1.5 text-[13px] text-text-secondary">{label}</p>}
      {hint && <p className="mt-2.5 text-xs text-text-secondary">{hint}</p>}
    </Card>
  );
}

export function Badge({ children, className = "" }) {
  return <span className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-medium ${className}`}>{children}</span>;
}

export function ProgressBar({ percent, color = "bg-brand", label }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full rounded-full bg-border">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

export function EmptyState({ children }) {
  return <p className="py-6 text-center text-sm text-text-secondary">{children}</p>;
}

export function PageState({ loading, error, onRetry, children }) {
  if (loading) return <p role="status" className="py-24 text-center text-text-secondary">Loading your dashboard…</p>;
  if (error) {
    return (
      <div role="alert" className="mx-auto max-w-[480px] py-24 text-center">
        <p className="text-text-primary">{error.message}</p>
        <button type="button" onClick={onRetry} className="mt-4 text-sm font-medium text-brand hover:text-brand-dark">Try again</button>
      </div>
    );
  }
  return children;
}

export function PendingNotice({ kind, suspended = false }) {
  if (suspended) {
    return (
      <div role="status" className="mt-8 rounded-xl border border-error/30 bg-error-light p-5 text-sm text-text-primary">
        <p className="font-semibold">Account suspended</p>
        <p className="mt-1 text-text-secondary">Your {kind} has been suspended by a TalentGrid admin. Contact support to restore access.</p>
      </div>
    );
  }
  return (
    <div role="status" className="mt-8 rounded-xl border border-warning/30 bg-warning-light p-5 text-sm text-text-primary">
      <p className="font-semibold">Verification pending</p>
      <p className="mt-1 text-text-secondary">
        Your {kind} is awaiting approval from a TalentGrid admin. Your dashboard will fill in once it is verified.
      </p>
    </div>
  );
}

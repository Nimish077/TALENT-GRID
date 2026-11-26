function AccountButton({ account, busyId, onSelect }) {
  const busy = busyId === account.id;
  return (
    <button
      type="button"
      onClick={() => onSelect(account)}
      disabled={Boolean(busyId)}
      aria-label={`Sign in as ${account.label}: ${account.email}`}
      className="rounded-[var(--radius-lg)] border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-brand hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-text-primary">{account.label}</span>
        {busy && <span className="text-[11px] text-text-muted">Signing in…</span>}
      </span>
      <span className="mt-0.5 block truncate text-[11px] text-text-secondary">{account.email}</span>
      <span className="mt-0.5 block text-[11px] text-text-muted">{account.note}</span>
    </button>
  );
}

// One-click demo sign-in. `accounts` are items from lib/demo-accounts.js;
// accounts with group "pending" are tucked into a disclosure.
function DemoAccounts({ accounts, onSelect, busyId = null }) {
  const main = accounts.filter((account) => account.group !== "pending");
  const pending = accounts.filter((account) => account.group === "pending");

  return (
    <section aria-label="Demo accounts" className="mt-5 rounded-xl border border-dashed border-border-strong bg-surface-muted/50 p-4 text-left">
      <p className="text-[13px] font-semibold text-text-primary">Demo accounts</p>
      <p className="mt-0.5 text-xs text-text-secondary">Click one to sign in instantly.</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {main.map((account) => (
          <AccountButton key={account.id} account={account} busyId={busyId} onSelect={onSelect} />
        ))}
      </div>

      {pending.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-brand hover:text-brand-dark">Accounts awaiting approval</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {pending.map((account) => (
              <AccountButton key={account.id} account={account} busyId={busyId} onSelect={onSelect} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

export default DemoAccounts;

import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import DemoAccounts from "../components/auth/demo-accounts.jsx";
import AuthLayout from "../components/layout/auth-layout.jsx";
import Button from "../components/ui/button.jsx";
import FormField from "../components/ui/form-field.jsx";
import { useAuth } from "../context/auth-context.js";
import { DEMO_ACCOUNTS, UNSEEDED_HINT, isDemoLoginEnabled } from "../lib/demo-accounts.js";

// Same API as the regular sign in, but only administrator accounts get through:
// anyone else is signed straight back out. (The real protection is the role
// check on every admin API route; this page just keeps the entry point honest.)
function AdminLogin() {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoBusy, setDemoBusy] = useState(null);

  if (loading) return null;
  if (user?.role === "admin") return <Navigate to="/dashboard" replace />;

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  // Signs in and keeps only administrators; anyone else is signed back out.
  async function signInAsAdmin(credentials, { demo = false } = {}) {
    setError("");
    try {
      const signedIn = await login(credentials);
      if (signedIn.role !== "admin") {
        await logout();
        setError("This account is not an administrator. Use the regular sign in instead.");
        return;
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(demo && err.status === 401 ? UNSEEDED_HINT : err.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    await signInAsAdmin({ email: form.email.trim(), password: form.password });
    setSubmitting(false);
  }

  async function handleDemo(account) {
    setDemoBusy(account.id);
    await signInAsAdmin({ email: account.email, password: account.password }, { demo: true });
    setDemoBusy(null);
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-[384px] text-center">
        <h1 className="text-2xl tracking-[-0.03em]">Admin sign in</h1>
        <p className="mt-1.5 text-sm text-text-secondary">Restricted to TalentGrid platform administrators</p>

        {user && (
          <p role="status" className="mt-6 rounded-[var(--radius)] border border-warning/30 bg-warning-light px-3.5 py-2.5 text-left text-sm text-text-primary">
            You are signed in as {user.full_name} ({user.role}). Signing in below replaces that session.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-7 space-y-4 rounded-xl border border-border bg-surface p-6 text-left shadow-sm">
          {error && (
            <p role="alert" className="rounded-[var(--radius)] border border-error/30 bg-error-light px-3.5 py-2.5 text-sm text-error">
              {error}
            </p>
          )}
          <FormField label="Admin email" type="email" autoComplete="username" placeholder="admin@example.com" required value={form.email} onChange={update("email")} />
          <FormField label="Password" type="password" autoComplete="current-password" placeholder="••••••••" required value={form.password} onChange={update("password")} />
          <Button type="submit" size="md" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in as admin"}
          </Button>
        </form>

        {isDemoLoginEnabled() && (
          <DemoAccounts accounts={DEMO_ACCOUNTS.filter((account) => account.role === "admin")} onSelect={handleDemo} busyId={demoBusy} />
        )}

        <p className="mt-5 text-sm text-text-secondary">
          Not an administrator?{" "}
          <Link to="/login" className="font-medium text-brand hover:text-brand-dark">Go to the regular sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default AdminLogin;

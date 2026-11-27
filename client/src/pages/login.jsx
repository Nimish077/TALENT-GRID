import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import DemoAccounts from "../components/auth/demo-accounts.jsx";
import AuthLayout from "../components/layout/auth-layout.jsx";
import Button from "../components/ui/button.jsx";
import FormField from "../components/ui/form-field.jsx";
import { useAuth } from "../context/auth-context.js";
import { DEMO_ACCOUNTS, UNSEEDED_HINT } from "../lib/demo-accounts.js";
import { useDemoLogin } from "../lib/use-demo-login.js";

function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from?.pathname ?? "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoBusy, setDemoBusy] = useState(null);
  const demoEnabled = useDemoLogin();

  if (user) return <Navigate to={destination} replace />;

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ email: form.email.trim(), password: form.password });
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemo(account) {
    setError("");
    setDemoBusy(account.id);
    try {
      await login({ email: account.email, password: account.password });
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.status === 401 ? UNSEEDED_HINT : err.message);
      setDemoBusy(null);
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-[384px] text-center">
        <h1 className="text-2xl tracking-[-0.03em]">Welcome back</h1>
        <p className="mt-1.5 text-sm text-text-secondary">Sign in to your TalentGrid account</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4 rounded-xl border border-border bg-surface p-6 text-left shadow-sm">
          {error && (
            <p role="alert" className="rounded-[var(--radius)] border border-error/30 bg-error-light px-3.5 py-2.5 text-sm text-error">
              {error}
            </p>
          )}
          <FormField label="Email address" type="email" autoComplete="email" placeholder="you@example.com" required value={form.email} onChange={update("email")} />
          <FormField label="Password" type="password" autoComplete="current-password" placeholder="••••••••" required value={form.password} onChange={update("password")} />
          <Button type="submit" size="md" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {demoEnabled && (
          <DemoAccounts accounts={DEMO_ACCOUNTS.filter((account) => account.role !== "admin")} onSelect={handleDemo} busyId={demoBusy} />
        )}

        <p className="mt-5 text-sm text-text-secondary">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-brand hover:text-brand-dark">Create one</Link>
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          Administrator?{" "}
          <Link to="/admin/login" className="font-medium text-brand hover:text-brand-dark">Sign in as admin</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Login;

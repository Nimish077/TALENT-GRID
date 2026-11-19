import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/layout/auth-layout.jsx";
import Button from "../components/ui/button.jsx";
import FormField from "../components/ui/form-field.jsx";
import { useAuth } from "../context/auth-context.js";

function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from?.pathname ?? "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <AuthLayout>
      <div className="w-full max-w-[480px] text-center">
        <h1 className="text-[28px] tracking-[-0.03em]">Welcome back</h1>
        <p className="mt-2 text-text-secondary">Sign in to your TalentGrid account</p>

        <form onSubmit={handleSubmit} className="mt-9 space-y-5 rounded-xl border border-border bg-surface p-7 text-left shadow-sm">
          {error && (
            <p role="alert" className="rounded-[var(--radius)] border border-error/30 bg-error-light px-3.5 py-2.5 text-sm text-error">
              {error}
            </p>
          )}
          <FormField label="Email address" type="email" autoComplete="email" placeholder="you@example.com" required value={form.email} onChange={update("email")} />
          <FormField label="Password" type="password" autoComplete="current-password" placeholder="••••••••" required value={form.password} onChange={update("password")} />
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-text-secondary">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-brand hover:text-brand-dark">Create one</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Login;

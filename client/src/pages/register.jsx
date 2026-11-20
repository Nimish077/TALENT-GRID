import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/layout/auth-layout.jsx";
import Button from "../components/ui/button.jsx";
import FormField from "../components/ui/form-field.jsx";
import { useAuth } from "../context/auth-context.js";
import { buildRegistrationPayload } from "../lib/registration.js";

const roles = [
  { id: "candidate", label: "Candidate", description: "Build a verified skill profile and discover opportunities." },
  { id: "employer", label: "Employer", description: "Find and hire talent based on verified skills." },
  { id: "institute", label: "Institute", description: "Develop student skills and connect them with employers." },
];

const orgLabels = {
  employer: { label: "Company name", placeholder: "Acme Corp" },
  institute: { label: "Institution name", placeholder: "BITS Pilani" },
};

function RoleIcon({ id }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (id === "candidate") return <svg {...common}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.2.7 3.5 2.6 3.5 5.6" /></svg>;
  if (id === "employer") return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></svg>;
  return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" /></svg>;
}

function Stepper({ step }) {
  return (
    <ol className="flex items-center justify-center gap-3 text-sm" aria-label="Registration progress">
      <li className="flex items-center gap-2.5 text-text-secondary" aria-current={step === 1 ? "step" : undefined}>
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand text-xs font-semibold text-surface">{step > 1 ? "✓" : "1"}</span>
        Choose role
      </li>
      <li aria-hidden="true" className="h-px w-10 bg-border" />
      <li className="flex items-center gap-2.5 text-text-secondary" aria-current={step === 2 ? "step" : undefined}>
        <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-semibold ${step === 2 ? "bg-brand text-surface" : "bg-surface-muted text-text-muted"}`}>2</span>
        Your details
      </li>
    </ol>
  );
}

function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedRole = params.get("role");
  const initialRole = roles.some((r) => r.id === requestedRole) ? requestedRole : null;

  const [step, setStep] = useState(1);
  const [role, setRole] = useState(initialRole);
  const [form, setForm] = useState({ fullName: "", orgName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const roleMeta = roles.find((r) => r.id === role);
  const org = orgLabels[role];

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    if (form.password.length < 8) {
      setFieldErrors({ password: "Must be at least 8 characters" });
      return;
    }
    setSubmitting(true);
    try {
      await register(buildRegistrationPayload(role, form));
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const mapped = {};
      for (const [path, message] of Object.entries(err.fieldErrors ?? {})) {
        if (path === "full_name") mapped.fullName = message;
        else if (path === "email") mapped.email = message;
        else if (path === "password") mapped.password = message;
        else if (path.endsWith(".name")) mapped.orgName = message;
      }
      setFieldErrors(mapped);
      // Show the banner for anything not attributable to a single field
      // (e.g. 409 "email already registered", network errors).
      setError(Object.keys(mapped).length ? "" : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-[640px]">
        <Stepper step={step} />

        {step === 1 ? (
          <>
            <div className="mt-12 text-center">
              <h1 className="text-[28px] tracking-[-0.03em]">Create your account</h1>
              <p className="mt-2 text-text-secondary">Choose how you want to use TalentGrid</p>
            </div>

            <div role="radiogroup" aria-label="Account type" className="mt-9 space-y-4">
              {roles.map((r) => {
                const selected = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setRole(r.id)}
                    className={`flex w-full items-center gap-4 rounded-lg border bg-surface p-[25px] text-left transition-colors ${selected ? "border-brand bg-brand-light ring-2 ring-brand/40" : "border-border hover:border-border-strong"}`}
                  >
                    <span className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-lg ${selected ? "bg-brand text-surface" : "bg-surface-muted text-text-secondary"}`}>
                      <RoleIcon id={r.id} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-semibold ${selected ? "text-brand" : "text-text-primary"}`}>{r.label}</span>
                      <span className="mt-1 block text-sm text-text-secondary">{r.description}</span>
                    </span>
                    {selected && <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-surface">✓</span>}
                  </button>
                );
              })}
            </div>

            <Button size="lg" className="mt-8 w-full" disabled={!role} onClick={() => setStep(2)}>Continue</Button>
          </>
        ) : (
          <>
            <div className="mt-10 text-center">
              <h1 className="text-[28px] tracking-[-0.03em]">Your details</h1>
              <p className="mt-2 text-text-secondary">
                Creating a <span className="font-medium text-brand">{roleMeta.label}</span> account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5 rounded-xl border border-border bg-surface p-7 shadow-sm">
              {error && (
                <p role="alert" className="rounded-[var(--radius)] border border-error/30 bg-error-light px-3.5 py-2.5 text-sm text-error">{error}</p>
              )}
              <FormField label="Full name" required autoComplete="name" placeholder="Arjun Sharma" minLength={2} value={form.fullName} onChange={update("fullName")} error={fieldErrors.fullName} />
              {org && (
                <FormField label={org.label} required placeholder={org.placeholder} minLength={2} value={form.orgName} onChange={update("orgName")} error={fieldErrors.orgName} />
              )}
              <FormField label={role === "candidate" ? "Email" : "Work email"} type="email" required autoComplete="email" placeholder="you@example.com" value={form.email} onChange={update("email")} error={fieldErrors.email} />
              <FormField label="Password" type="password" required autoComplete="new-password" placeholder="Min. 8 characters" minLength={8} maxLength={72} hint="Must be at least 8 characters" value={form.password} onChange={update("password")} error={fieldErrors.password} />
              <div className="flex gap-4 pt-1">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" size="lg" className="flex-1" disabled={submitting}>{submitting ? "Creating…" : "Create account"}</Button>
              </div>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-text-secondary">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand hover:text-brand-dark">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Register;

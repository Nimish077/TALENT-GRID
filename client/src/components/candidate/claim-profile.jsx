import { useEffect, useState } from "react";
import { Card } from "../dashboard/primitives.jsx";
import Button from "../ui/button.jsx";
import { claimsApi } from "../../lib/endpoints.js";

function ClaimRow({ match, onClaimed }) {
  const [enrollment, setEnrollment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await claimsApi.claim(match.id, enrollment.trim());
      onClaimed(match.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const details = [match.program, match.department, match.batch].filter(Boolean).join(" · ");
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{match.institution.name}</p>
        <p className="text-xs text-text-secondary">
          {match.full_name}
          {details && ` · ${details}`} · Enrollment id {match.enrollment_hint}
        </p>
      </div>
      <input
        aria-label={`Enrollment id for ${match.institution.name}`}
        required
        value={enrollment}
        onChange={(e) => setEnrollment(e.target.value)}
        placeholder="Your enrollment id"
        className="h-10 w-44 rounded-[var(--radius)] border border-border bg-surface px-3 text-sm focus:border-brand focus:outline-none"
      />
      <Button type="submit" size="sm" disabled={busy || !enrollment.trim()}>
        {busy ? "Claiming…" : "Claim profile"}
      </Button>
      {error && (
        <p role="alert" className="basis-full text-xs text-error">
          {error}
        </p>
      )}
    </form>
  );
}

// Shown when an institute has already created a profile for this student's email.
function ClaimProfile() {
  const [matches, setMatches] = useState([]);
  const [claimed, setClaimed] = useState(null);

  useEffect(() => {
    let active = true;
    claimsApi
      .matches()
      .then((res) => active && setMatches(res.matches ?? []))
      .catch(() => active && setMatches([]));
    return () => {
      active = false;
    };
  }, []);

  if (claimed) {
    return (
      <p role="status" className="mt-5 rounded-[var(--radius)] border border-accent/30 bg-accent-muted px-4 py-3 text-sm text-accent-dark">
        Profile claimed. {claimed} can now see your verified skills.
      </p>
    );
  }
  if (matches.length === 0) return null;

  return (
    <Card className="mt-5 border-brand/30 bg-brand-light/40 p-5" role="region" aria-label="Claim your institute profile">
      <p className="text-[15px] font-semibold">Your institute has a profile for you</p>
      <p className="mt-0.5 text-xs text-text-secondary">It matches the email you signed up with. Confirm your enrollment id to claim it.</p>
      <div className="mt-4 space-y-4">
        {matches.map((match) => (
          <ClaimRow
            key={match.id}
            match={match}
            onClaimed={() => {
              setClaimed(match.institution.name);
              setMatches([]);
            }}
          />
        ))}
      </div>
    </Card>
  );
}

export default ClaimProfile;

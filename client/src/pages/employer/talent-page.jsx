import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, EmptyState } from "../../components/dashboard/primitives.jsx";
import AppShell from "../../components/layout/app-shell.jsx";
import RequirementBuilder from "../../components/talent/requirement-builder.jsx";
import { Avatar, GapChip, InviteControl, MatchBadge, VerifiedChip } from "../../components/talent/talent-ui.jsx";
import Button from "../../components/ui/button.jsx";
import { talentApi, skillsApi } from "../../lib/endpoints.js";
import { LEVELS } from "../../lib/format.js";
import { useResource } from "../../lib/use-resource.js";

const PAGE_SIZE = 12;
const inputCls = "h-10 w-full rounded-[var(--radius)] border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

function parseRequirements(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.split(":"))
    .filter(([id, level]) => id && LEVELS.includes(level))
    .map(([skillId, level]) => ({ skillId, level, name: skillId }));
}

const serializeRequirements = (reqs) => reqs.map((r) => `${r.skillId}:${r.level}`).join(",");

function CandidateCard({ item }) {
  const verified = item.skills.filter((s) => s.verification_status === "verified");
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
        <Avatar name={item.full_name} src={item.avatar_url} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold tracking-tight">{item.full_name}</h3>
          {item.headline && <p className="text-sm text-text-secondary">{item.headline}</p>}
          {item.location && <p className="text-xs text-text-muted">{item.location}</p>}
        </div>
        <MatchBadge percent={item.match_percent} />
      </div>

      {item.matched_skills.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-text-secondary">Matched (verified)</p>
          <div className="flex flex-wrap gap-1.5">
            {item.matched_skills.map((s) => <VerifiedChip key={s.skill_id} level={s.required_level}>{s.name}</VerifiedChip>)}
          </div>
        </div>
      )}
      {item.gaps.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-text-secondary">Gaps</p>
          <div className="flex flex-wrap gap-1.5">
            {item.gaps.map((g) => <GapChip key={g.skill_id} gap={g} />)}
          </div>
        </div>
      )}
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-text-secondary">
          Verified skills ({item.verified_skill_count ?? verified.length})
        </p>
        {verified.length ? (
          <div className="flex flex-wrap gap-1.5">
            {verified.map((s) => <VerifiedChip key={s.skill_id} level={s.verified_level}>{s.name}</VerifiedChip>)}
          </div>
        ) : (
          <p className="text-xs text-text-muted">No verified skills yet.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-border pt-3">
        <Button to={`/employer/talent/${item.candidate_profile_id}`} variant="outline" size="sm">View profile</Button>
        <InviteControl candidateProfileId={item.candidate_profile_id} align="left" />
      </div>
    </Card>
  );
}

function ResultsSkeleton() {
  return (
    <div role="status" aria-label="Loading candidates" className="space-y-4">
      {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-surface-muted" />)}
    </div>
  );
}

function Results({ query }) {
  const [, setSearchParams] = useSearchParams();
  const { data, error, loading, reload } = useResource(() => talentApi.search(Object.fromEntries(query)));
  return <ResultsView data={data} error={error} loading={loading} reload={reload} setSearchParams={setSearchParams} query={query} />;
}

function ResultsView({ data, error, loading, reload, setSearchParams, query }) {
  if (error && error.status === 403) {
    return (
      <div role="status" className="rounded-xl border border-warning/30 bg-warning-light p-5 text-sm text-text-primary">
        <p className="font-semibold">Verification pending</p>
        <p className="mt-1 text-text-secondary">{error.message}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-sm">{error.message}</p>
        <button type="button" onClick={reload} className="mt-3 text-sm font-medium text-brand hover:text-brand-dark">Try again</button>
      </div>
    );
  }
  if (loading && !data) return <ResultsSkeleton />;
  if (!data) return null;

  const { items, pagination } = data;
  if (items.length === 0) {
    return (
      <Card className="p-4">
        <EmptyState>
          {query.get("skills")
            ? "No verified candidates match these requirements - try lowering a level."
            : "No verified candidates found."}
        </EmptyState>
      </Card>
    );
  }
  const from = (pagination.page - 1) * pagination.limit + 1;
  const to = from + items.length - 1;
  const goTo = (page) => {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    setSearchParams(next);
  };
  return (
    <div className={loading ? "opacity-60" : undefined} aria-busy={loading}>
      <ul className="space-y-4">
        {items.map((item) => <li key={item.candidate_profile_id}><CandidateCard item={item} /></li>)}
      </ul>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">Showing {from}-{to} of {pagination.total}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => goTo(pagination.page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={pagination.page >= pagination.total_pages} onClick={() => goTo(pagination.page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

export default function TalentPage() {
  const [params, setParams] = useSearchParams();
  const [skills, setSkills] = useState([]);
  const [requirements, setRequirements] = useState(() => parseRequirements(params.get("skills")));
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [location, setLocation] = useState(params.get("location") ?? "");
  const [minMatch, setMinMatch] = useState(params.get("min_match") ?? "0");

  useEffect(() => {
    let active = true;
    skillsApi.list({ limit: 100 }).then((res) => active && setSkills(res.items ?? [])).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const named = useMemo(
    () => requirements.map((r) => ({ ...r, name: skills.find((s) => s.id === r.skillId)?.name ?? r.name })),
    [requirements, skills],
  );

  const query = useMemo(() => {
    const q = new URLSearchParams();
    for (const key of ["skills", "search", "location", "min_match", "page"]) {
      const value = params.get(key);
      if (value) q.set(key, value);
    }
    q.set("limit", String(PAGE_SIZE));
    return q;
  }, [params]);

  function submit(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (requirements.length) next.set("skills", serializeRequirements(requirements));
    if (search.trim()) next.set("search", search.trim());
    if (location.trim()) next.set("location", location.trim());
    if (minMatch !== "0") next.set("min_match", minMatch);
    setParams(next);
  }

  return (
    <AppShell title="Talent Search" subtitle="Find candidates by verified skills, not just claims.">
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <RequirementBuilder skills={skills} requirements={named} onChange={setRequirements} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="talent-search" className="mb-1.5 block text-[13px] font-medium">Name or headline</label>
              <input id="talent-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. backend engineer" className={inputCls} />
            </div>
            <div>
              <label htmlFor="talent-location" className="mb-1.5 block text-[13px] font-medium">Location</label>
              <input id="talent-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bengaluru" className={inputCls} />
            </div>
            <div>
              <label htmlFor="talent-min" className="mb-1.5 block text-[13px] font-medium">Minimum match</label>
              <select id="talent-min" value={minMatch} onChange={(e) => setMinMatch(e.target.value)} className={inputCls}>
                {["0", "50", "75", "100"].map((v) => <option key={v} value={v}>{v === "0" ? "Any" : `${v}%+`}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">
              Matching counts verified skills only. Skills a candidate merely claims never raise the match.
            </p>
            <Button type="submit">Search</Button>
          </div>
        </form>
      </Card>
      <div className="mt-5">
        <Results key={query.toString()} query={query} />
      </div>
      <p className="mt-6 text-xs text-text-muted">
        Need a job to invite candidates to? <Link to="/employer/jobs/new" className="text-brand hover:text-brand-dark">Post a job</Link>
      </p>
    </AppShell>
  );
}

import { useId, useMemo, useState } from "react";
import { LEVELS, capitalize } from "../../lib/format.js";

const selectCls = "h-10 rounded-[var(--radius)] border border-border bg-surface px-3 text-sm text-text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

// requirements: [{ skillId, name, level }]
export default function RequirementBuilder({ skills, requirements, onChange }) {
  const id = useId();
  const [filter, setFilter] = useState("");
  const [skillId, setSkillId] = useState("");
  const [level, setLevel] = useState("intermediate");

  const options = useMemo(() => {
    const used = new Set(requirements.map((r) => r.skillId));
    const q = filter.trim().toLowerCase();
    return skills.filter((s) => !used.has(s.id) && (!q || s.name.toLowerCase().includes(q)));
  }, [skills, requirements, filter]);

  function add() {
    const skill = skills.find((s) => s.id === skillId);
    if (!skill) return;
    onChange([...requirements, { skillId: skill.id, name: skill.name, level }]);
    setSkillId("");
    setFilter("");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[140px] flex-1">
          <label htmlFor={`${id}-q`} className="mb-1.5 block text-[13px] font-medium">Find a skill</label>
          <input id={`${id}-q`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search skills…" className={`${selectCls} w-full placeholder:text-text-muted`} />
        </div>
        <div className="min-w-[140px] flex-1">
          <label htmlFor={`${id}-s`} className="mb-1.5 block text-[13px] font-medium">Skill</label>
          <select id={`${id}-s`} value={skillId} onChange={(e) => setSkillId(e.target.value)} className={`${selectCls} w-full`}>
            <option value="">Select a skill…</option>
            {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-l`} className="mb-1.5 block text-[13px] font-medium">Minimum level</label>
          <select id={`${id}-l`} value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls}>
            {LEVELS.map((l) => <option key={l} value={l}>{capitalize(l)}</option>)}
          </select>
        </div>
        <button type="button" onClick={add} disabled={!skillId} className="h-10 rounded-[var(--radius)] border border-border-strong bg-surface px-4 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50">
          Add requirement
        </button>
      </div>
      {requirements.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Skill requirements">
          {requirements.map((r) => (
            <li key={r.skillId} className="inline-flex items-center gap-1.5 rounded-full bg-brand-light py-1 pl-3 pr-1.5 text-xs font-medium text-brand">
              {r.name} · {capitalize(r.level)}+
              <button type="button" onClick={() => onChange(requirements.filter((x) => x.skillId !== r.skillId))} aria-label={`Remove ${r.name}`} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-brand">
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

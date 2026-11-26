import { useEffect, useState } from "react";

// mm:ss (or h:mm:ss) for a millisecond duration; never negative.
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Re-renders every `intervalMs` and returns Date.now().
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}

export const levelStyle = {
  beginner: "bg-surface-muted text-text-secondary",
  intermediate: "bg-brand-light text-brand",
  advanced: "bg-accent-muted text-accent-dark",
};

function Svg({ children, size = 16, strokeWidth = 1.8, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export function ArrowIcon() {
  return <Svg size={16} className="ml-1.5 shrink-0"><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
}

export function CheckIcon() {
  return (
    <span aria-hidden="true" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent">
      <Svg size={13} strokeWidth={2.4}><path d="m5 12 5 5 9-10" /></Svg>
    </span>
  );
}

export function CircleCheckIcon({ size = 14 }) {
  return <Svg size={size}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Svg>;
}

export function PinIcon() {
  return <Svg size={13}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></Svg>;
}

export function BriefcaseIcon() {
  return <Svg size={13}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></Svg>;
}

const eyebrowTones = {
  brand: "text-brand",
  accent: "text-accent",
};

export function SectionHeading({ eyebrow, title, tone = "brand" }) {
  return (
    <div className="text-center">
      {eyebrow && <p className={`text-xs font-semibold tracking-[0.12em] ${eyebrowTones[tone]}`}>{eyebrow}</p>}
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{title}</h2>
    </div>
  );
}

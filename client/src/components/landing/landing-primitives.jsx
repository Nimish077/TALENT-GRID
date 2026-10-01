export function ArrowIcon() {
  return <span aria-hidden="true" className="ml-1 text-lg leading-none">&rarr;</span>;
}

export function CheckIcon() {
  return (
    <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-bold text-accent">
      &check;
    </span>
  );
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

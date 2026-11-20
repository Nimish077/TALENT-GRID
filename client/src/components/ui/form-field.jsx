import { useId } from "react";

function FormField({ label, error, hint, required = false, className = "", ...inputProps }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-text-primary">
        {label}
        {required && <span className="ml-0.5 text-error" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        className={[
          "h-10 w-full rounded-[var(--radius)] border bg-surface px-3 text-sm text-text-primary",
          "placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
          error ? "border-error" : "border-border",
        ].join(" ")}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-error">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-text-secondary">{hint}</p>
      ) : null}
    </div>
  );
}

export default FormField;

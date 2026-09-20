import { Link } from "react-router-dom";

const variants = {
  primary:
    "bg-brand text-white hover:bg-brand-dark",
  secondary:
    "bg-surface-muted text-text-primary hover:bg-border",
  outline:
    "border border-border-strong bg-surface text-text-primary hover:bg-surface-muted",
  ghost:
    "text-text-secondary hover:text-text-primary",
};

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

function Button({
  children,
  variant = "primary",
  size = "md",
  to,
  type = "button",
  disabled = false,
  className = "",
  onClick,
  ...props
}) {
  const classes = [
    "inline-flex items-center justify-center",
    "rounded-[var(--radius)]",
    "font-medium",
    "transition-colors duration-150",
    "focus-visible:outline-2",
    "focus-visible:outline-brand",
    "focus-visible:outline-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  ].join(" ");

  if (to) {
    return (
      <Link
        to={to}
        className={classes}
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }

          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={classes}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
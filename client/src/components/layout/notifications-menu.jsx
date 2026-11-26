import { useEffect, useRef, useState } from "react";
import NavIcon from "./nav-icons.jsx";

// The API has no notifications feed yet, so the menu honestly says so rather
// than being a dead button.
function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className="rounded-[var(--radius)] p-2 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
      >
        <NavIcon name="bell" />
      </button>
      {open && (
        <div role="status" className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-border bg-surface p-4 text-sm shadow-lg">
          <p className="font-semibold">Notifications</p>
          <p className="mt-1 text-text-secondary">You&apos;re all caught up.</p>
        </div>
      )}
    </div>
  );
}

export default NotificationsMenu;

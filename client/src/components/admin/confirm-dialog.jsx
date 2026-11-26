import { useEffect, useId, useRef } from "react";
import Button from "../ui/button.jsx";

// Small modal confirmation. Focus starts on Cancel; Escape cancels.
export default function ConfirmDialog({ title, message, confirmLabel, destructive = false, busy = false, error, onConfirm, onCancel }) {
  const titleId = useId();
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function onKeyDown(event) {
    if (event.key === "Escape" && !busy) onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onKeyDown={onKeyDown}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-lg">
        <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-text-secondary">{message}</p>
        {error && <p role="alert" className="mt-3 rounded-lg bg-error-light px-3 py-2 text-[13px] text-error">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} variant="outline" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={onConfirm}
            className={destructive ? "!bg-error hover:!opacity-90" : ""}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

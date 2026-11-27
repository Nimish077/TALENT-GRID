import { useState } from "react";
import { Card, CardHeader } from "../dashboard/primitives.jsx";
import Button from "../ui/button.jsx";
import { CSV_TEMPLATE, rosterFromCsv } from "../../lib/csv.js";
import { institutionsApi } from "../../lib/endpoints.js";

const MAX_ROWS = 500;

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "talentgrid-student-roster-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

// Upload a roster CSV: each row becomes a "shadow" student profile that the real
// student claims by signing up with the same email and confirming the enrollment id.
function RosterImport({ institutionId, onImported }) {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [state, setState] = useState({ kind: "idle", message: "", errors: [] });

  async function choose(event) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setState({ kind: "idle", message: "", errors: [] });
    if (!next) return setParsed(null);
    const text = await next.text();
    setParsed(rosterFromCsv(text));
  }

  async function upload() {
    if (!parsed?.rows.length) return;
    if (parsed.rows.length > MAX_ROWS) {
      setState({ kind: "error", message: `Upload at most ${MAX_ROWS} students at a time.`, errors: [] });
      return;
    }
    setState({ kind: "uploading", message: "", errors: [] });
    try {
      const result = await institutionsApi.importStudents(institutionId, { file_name: file?.name ?? null, rows: parsed.rows });
      const summary = result.import;
      setState({
        kind: "done",
        message: `${summary.successful_rows} profile${summary.successful_rows === 1 ? "" : "s"} created${summary.failed_rows ? `, ${summary.failed_rows} skipped` : ""}.`,
        errors: (result.errors ?? []).map((e) => `Row ${e.row} (${e.enrollment_id}): ${e.reason}`),
      });
      setFile(null);
      setParsed(null);
      onImported?.();
    } catch (err) {
      setState({ kind: "error", message: err.message, errors: [] });
    }
  }

  return (
    <Card className="p-5">
      <CardHeader title="Import students from CSV" />
      <p className="mt-2 text-sm text-text-secondary">
        Each row creates a student profile that waits to be claimed. A student claims theirs by signing up with the same email and
        confirming their enrollment id. Needs <code>enrollment_id</code>, <code>full_name</code> and at least one email.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="Student roster CSV"
          onChange={choose}
          className="text-sm file:mr-3 file:rounded-[var(--radius)] file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm"
        />
        <Button variant="ghost" size="sm" type="button" onClick={downloadTemplate}>Download template</Button>
      </div>

      {parsed && (
        <div className="mt-4 text-sm" role="status">
          <p>
            <strong>{parsed.rows.length}</strong> valid row{parsed.rows.length === 1 ? "" : "s"}
            {parsed.errors.length > 0 && <>, <strong className="text-error">{parsed.errors.length}</strong> with problems (these will be skipped)</>}.
          </p>
          {parsed.errors.length > 0 && (
            <ul className="mt-2 max-h-36 list-disc overflow-auto pl-5 text-xs text-error">
              {parsed.errors.slice(0, 50).map((e) => <li key={`${e.line}-${e.message}`}>Line {e.line}: {e.message}</li>)}
            </ul>
          )}
          <Button className="mt-3" size="sm" disabled={!parsed.rows.length || state.kind === "uploading"} onClick={upload}>
            {state.kind === "uploading" ? "Uploading…" : `Create ${parsed.rows.length} profile${parsed.rows.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}

      {state.message && (
        <p role={state.kind === "error" ? "alert" : "status"} className={`mt-3 text-sm ${state.kind === "error" ? "text-error" : "text-accent-dark"}`}>
          {state.message}
        </p>
      )}
      {state.errors.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-text-secondary">
          {state.errors.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
    </Card>
  );
}

export default RosterImport;

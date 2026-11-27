// Student roster CSV -> rows for POST /institutions/:id/imports.
//
// Headers are matched loosely (case, spaces, underscores, common aliases), so a
// spreadsheet exported by an institute usually works without editing.

export const CSV_TEMPLATE =
  "enrollment_id,full_name,institutional_email,personal_email,phone,department,program,batch,graduation_year,current_semester,cgpa,backlog_count\n" +
  "E2401,Asha Rao,asha@college.edu,asha.rao@gmail.com,9876543210,Computer Science,B.Tech,2027,2027,6,8.4,0\n";

const ALIASES = {
  enrollment_id: ["enrollment_id", "enrollment", "enrolment_id", "roll_no", "roll_number", "student_id", "id"],
  full_name: ["full_name", "name", "student_name"],
  institutional_email: ["institutional_email", "college_email", "institute_email", "email"],
  personal_email: ["personal_email", "alternate_email", "other_email"],
  phone: ["phone", "mobile", "phone_number", "contact"],
  department: ["department", "dept", "branch"],
  program: ["program", "programme", "course", "degree"],
  batch: ["batch", "year_of_admission"],
  graduation_year: ["graduation_year", "passing_year", "grad_year"],
  current_semester: ["current_semester", "semester", "sem"],
  cgpa: ["cgpa", "gpa"],
  backlog_count: ["backlog_count", "backlogs", "backlog"],
};

const key = (header) => header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// RFC 4180-ish: quoted fields, escaped quotes, commas/newlines inside quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const num = (value) => (value === "" ? null : Number(value));

// Returns { rows, errors: [{ line, message }] }. `line` is the spreadsheet line
// number (header is line 1). Invalid rows are reported, valid ones kept.
export function rosterFromCsv(text) {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: "The file is empty" }] };

  const headers = table[0].map(key);
  const column = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    const index = headers.findIndex((header) => names.includes(header));
    if (index !== -1) column[field] = index;
  }
  if (column.enrollment_id === undefined || column.full_name === undefined) {
    return {
      rows: [],
      errors: [{ line: 1, message: "The header row needs at least enrollment_id and full_name columns" }],
    };
  }

  const rows = [];
  const errors = [];
  const seen = new Set();
  table.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const get = (field) => (column[field] === undefined ? "" : (cells[column[field]] ?? "").trim());
    const row = {
      enrollment_id: get("enrollment_id"),
      full_name: get("full_name"),
    };
    for (const field of ["institutional_email", "personal_email"]) {
      if (get(field)) row[field] = get(field).toLowerCase();
    }
    for (const field of ["phone", "department", "program", "batch"]) {
      if (get(field)) row[field] = get(field);
    }
    for (const field of ["graduation_year", "current_semester", "cgpa", "backlog_count"]) {
      if (get(field) !== "") row[field] = num(get(field));
    }

    const problem = (() => {
      if (!row.enrollment_id) return "Missing enrollment id";
      if (row.full_name.length < 2) return "Missing student name";
      if (seen.has(row.enrollment_id.toLowerCase())) return `Duplicate enrollment id ${row.enrollment_id}`;
      for (const field of ["institutional_email", "personal_email"]) {
        if (row[field] && !EMAIL.test(row[field])) return `Invalid ${field.replace("_", " ")}`;
      }
      for (const field of ["graduation_year", "current_semester", "cgpa", "backlog_count"]) {
        if (row[field] !== undefined && !Number.isFinite(row[field])) return `${field.replace("_", " ")} must be a number`;
      }
      if (row.cgpa != null && (row.cgpa < 0 || row.cgpa > 10)) return "CGPA must be between 0 and 10";
      if (!row.institutional_email && !row.personal_email) return "Needs at least one email so the student can claim the profile";
      return null;
    })();

    if (problem) errors.push({ line, message: problem });
    else {
      seen.add(row.enrollment_id.toLowerCase());
      rows.push(row);
    }
  });
  return { rows, errors };
}

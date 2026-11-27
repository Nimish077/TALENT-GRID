import { describe, expect, it } from "vitest";
import { parseCsv, rosterFromCsv } from "./csv.js";

describe("rosterFromCsv", () => {
  it("parses quoted fields and aliased headers", () => {
    const text = 'Roll No,Name,Email,Branch,CGPA\r\nE1,"Rao, Asha",ASHA@NT.EDU,CSE,8.4\r\n';
    const { rows, errors } = rosterFromCsv(text);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { enrollment_id: "E1", full_name: "Rao, Asha", institutional_email: "asha@nt.edu", department: "CSE", cgpa: 8.4 },
    ]);
  });

  it("reports bad rows by line and keeps good ones", () => {
    const text = "enrollment_id,full_name,institutional_email,cgpa\nE1,Asha,asha@nt.edu,8\nE1,Dup,dup@nt.edu,7\nE3,Bob,not-an-email,7\nE4,Cy,cy@nt.edu,11\nE5,Di,,\n";
    const { rows, errors } = rosterFromCsv(text);
    expect(rows.map((r) => r.enrollment_id)).toEqual(["E1"]);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6]);
  });

  it("needs the key columns", () => {
    expect(rosterFromCsv("a,b\n1,2").errors[0].message).toMatch(/enrollment_id/);
    expect(rosterFromCsv("").rows).toEqual([]);
  });

  it("handles escaped quotes", () => {
    expect(parseCsv('a,"b ""c"""\n')).toEqual([["a", 'b "c"']]);
  });
});

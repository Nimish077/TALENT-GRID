import { describe, expect, it } from "vitest";
import { buildJobPayload, buildSkillRequirements } from "./job-form.js";

const base = {
  title: " Senior React Developer ", description: "", location: "Bengaluru", workMode: "hybrid",
  employmentType: "", experienceLevel: "3-6 years", salaryMinLpa: "25", salaryMaxLpa: "40", deadline: "",
};

describe("buildJobPayload", () => {
  it("converts LPA to annual INR and blanks to null", () => {
    const { payload } = buildJobPayload(base);
    expect(payload).toMatchObject({
      title: "Senior React Developer", description: null, location: "Bengaluru", work_mode: "hybrid",
      employment_type: null, salary_min: 2500000, salary_max: 4000000, application_deadline: null,
    });
  });

  it("rejects min salary above max", () => {
    expect(buildJobPayload({ ...base, salaryMinLpa: "50" }).error).toMatch(/minimum salary/i);
  });

  it("allows no salary at all and serialises a deadline", () => {
    const { payload } = buildJobPayload({ ...base, salaryMinLpa: "", salaryMaxLpa: "", deadline: "2027-01-31" });
    expect(payload.salary_min).toBeNull();
    expect(typeof payload.application_deadline).toBe("string");
  });
});

describe("buildSkillRequirements", () => {
  it("drops blank rows and duplicate skills", () => {
    const rows = [
      { skillId: "a", level: "advanced" }, { skillId: "", level: "beginner" }, { skillId: "a", level: "beginner" },
      { skillId: "b", level: "intermediate" },
    ];
    expect(buildSkillRequirements(rows)).toEqual([
      { skill_id: "a", required_level: "advanced", is_required: true },
      { skill_id: "b", required_level: "intermediate", is_required: true },
    ]);
  });
});

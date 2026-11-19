import { describe, expect, it } from "vitest";
import { buildRegistrationPayload, deriveInstitutionCode } from "./registration.js";

const fields = { fullName: " Arjun Sharma ", orgName: " BITS Pilani ", email: " a@b.com ", password: "secret123" };

describe("buildRegistrationPayload", () => {
  it("builds a flat candidate payload", () => {
    expect(buildRegistrationPayload("candidate", fields)).toEqual({
      role: "candidate", full_name: "Arjun Sharma", email: "a@b.com", password: "secret123",
    });
  });

  it("nests the company under organization for employers", () => {
    const payload = buildRegistrationPayload("employer", fields);
    expect(payload.organization).toEqual({ name: "BITS Pilani" });
    expect(payload.institution).toBeUndefined();
  });

  it("nests the institution with a derived code for institutes", () => {
    const { institution } = buildRegistrationPayload("institute", fields);
    expect(institution.name).toBe("BITS Pilani");
    expect(institution.code).toMatch(/^BITS-PILANI-[A-Z0-9]{1,4}$/);
  });
});

describe("deriveInstitutionCode", () => {
  it("stays within the API's 2-40 character limit and handles odd names", () => {
    const long = deriveInstitutionCode("A".repeat(200));
    expect(long.length).toBeLessThanOrEqual(40);
    expect(deriveInstitutionCode("!!!")).toMatch(/^INST-/);
  });
});

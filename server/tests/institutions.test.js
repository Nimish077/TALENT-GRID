import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  prisma,
  resetDb,
  registerUser,
  makeAdmin,
  bearer,
  lastOtpFor,
} from "./helpers/index.js";

beforeEach(resetDb);

async function setupInstitution() {
  const institute = await registerUser({
    role: "institute",
    extra: { institution: { name: "National Tech", code: "NT-1" } },
  });
  const institution = await prisma.institution.findUnique({
    where: { code: "NT-1" },
  });
  const admin = await makeAdmin();
  const verify = await bearer(
    request(app).post(`/api/v1/admin/institutions/${institution.id}/verify`),
    admin.accessToken
  );
  expect(verify.status).toBe(200);
  return { institute, institution, admin };
}

function createMembership(institutionId, token, overrides = {}) {
  return bearer(
    request(app).post(`/api/v1/institutions/${institutionId}/memberships`),
    token
  ).send({
    enrollment_id: "ENR-001",
    full_name: "Asha Rao",
    institutional_email: "asha@nt.edu",
    department: "CSE",
    batch: "2026",
    cgpa: 8.1,
    backlog_count: 0,
    ...overrides,
  });
}

describe("membership management & imports", () => {
  it("blocks unverified institutions and lets verified institutes manage memberships", async () => {
    const institute = await registerUser({
      role: "institute",
      extra: { institution: { name: "Pending Poly", code: "PP-1" } },
    });
    const institution = await prisma.institution.findFirst();
    expect(institution.status).toBe("pending");

    const blocked = await createMembership(
      institution.id,
      institute.accessToken
    );
    expect(blocked.status).toBe(403);

    const admin = await makeAdmin();
    await bearer(
      request(app).post(`/api/v1/admin/institutions/${institution.id}/verify`),
      admin.accessToken
    );
    const allowed = await createMembership(
      institution.id,
      institute.accessToken
    );
    expect(allowed.status).toBe(201);
    expect(allowed.body.data.membership.verification_status).toBe("unverified");
  });

  it("processes imports with per-row outcomes and institute attestation", async () => {
    const { institution, institute } = await setupInstitution();

    const res = await bearer(
      request(app).post(`/api/v1/institutions/${institution.id}/imports`),
      institute.accessToken
    ).send({
      file_name: "batch-2026.csv",
      rows: [
        {
          enrollment_id: "IMP-1",
          full_name: "Student One",
          institutional_email: "one@nt.edu",
        },
        {
          enrollment_id: "IMP-2",
          full_name: "Student Two",
          institutional_email: "two@nt.edu",
        },
        {
          enrollment_id: "IMP-1",
          full_name: "Duplicate Row",
          institutional_email: "one@nt.edu",
        },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.import.status).toBe("partial");
    expect(res.body.data.import.successful_rows).toBe(2);
    expect(res.body.data.import.failed_rows).toBe(1);

    const imported = await prisma.institutionMembership.findUnique({
      where: {
        institution_id_enrollment_id: {
          institution_id: institution.id,
          enrollment_id: "IMP-1",
        },
      },
    });
    expect(imported.verification_status).toBe("verified");
    expect(imported.verification_source).toBe("institution_import");
    expect(imported.verified_at).not.toBeNull();
  });

  it("institute-attested verification endpoint works and is idempotent-guarded", async () => {
    const { institution, institute } = await setupInstitution();
    const created = await createMembership(
      institution.id,
      institute.accessToken,
      {
        enrollment_id: "MANUAL-1",
      }
    );
    const membershipId = created.body.data.membership.id;

    const verify = await bearer(
      request(app).post(
        `/api/v1/institutions/${institution.id}/memberships/${membershipId}/verify`
      ),
      institute.accessToken
    );
    expect(verify.status).toBe(200);
    expect(verify.body.data.membership.verification_status).toBe("verified");
    expect(verify.body.data.membership.verification_source).toBe("institute");

    const again = await bearer(
      request(app).post(
        `/api/v1/institutions/${institution.id}/memberships/${membershipId}/verify`
      ),
      institute.accessToken
    );
    expect(again.status).toBe(409);
  });

  it("candidates cannot touch institution management endpoints", async () => {
    const { institution } = await setupInstitution();
    const candidate = await registerUser();

    const res = await createMembership(institution.id, candidate.accessToken);
    expect(res.status).toBe(403);
  });
});

describe("membership claims via OTP", () => {
  async function setupClaim({ email = "asha@nt.edu" } = {}) {
    const { institution, institute } = await setupInstitution();
    await createMembership(institution.id, institute.accessToken, {
      institutional_email: email,
      enrollment_id: "CLAIM-1",
    });
    const membership = await prisma.institutionMembership.findUnique({
      where: {
        institution_id_enrollment_id: {
          institution_id: institution.id,
          enrollment_id: "CLAIM-1",
        },
      },
    });
    const candidate = await registerUser();
    const claim = await bearer(
      request(app).post("/api/v1/membership-claims"),
      candidate.accessToken
    ).send({
      institution_id: institution.id,
      enrollment_id: "CLAIM-1",
      requested_email: email,
    });
    return { institution, institute, membership, candidate, claim };
  }

  it("walks the happy path: request, wrong code, right code, linked membership", async () => {
    const { membership, candidate, claim } = await setupClaim();
    expect(claim.status).toBe(201);
    const claimId = claim.body.data.claim.id;

    const otp = lastOtpFor("asha@nt.edu");
    expect(otp).toMatch(/^\d{6}$/);

    const wrong = await bearer(
      request(app).post(`/api/v1/membership-claims/${claimId}/verify`),
      candidate.accessToken
    ).send({ otp: otp === "000000" ? "111111" : "000000" });
    expect(wrong.status).toBe(400);

    const afterWrong = await prisma.institutionMembershipClaim.findUnique({
      where: { id: claimId },
    });
    expect(afterWrong.otp_attempts).toBe(1);

    const right = await bearer(
      request(app).post(`/api/v1/membership-claims/${claimId}/verify`),
      candidate.accessToken
    ).send({ otp });
    expect(right.status).toBe(200);
    expect(right.body.data.membership.verification_source).toBe("email_otp");
    expect(right.body.data.membership.user_id).toBe(candidate.user.id);

    const linked = await prisma.institutionMembership.findUnique({
      where: { id: membership.id },
    });
    expect(linked.verification_status).toBe("verified");
    expect(linked.user_id).toBe(candidate.user.id);

    const again = await bearer(
      request(app).post(`/api/v1/membership-claims/${claimId}/verify`),
      candidate.accessToken
    ).send({ otp });
    expect(again.status).toBe(409);
  });

  it("rejects emails that do not match the membership record", async () => {
    const { institution, institute } = await setupInstitution();
    await createMembership(institution.id, institute.accessToken, {
      enrollment_id: "MISMATCH-1",
    });
    const candidate = await registerUser();

    const res = await bearer(
      request(app).post("/api/v1/membership-claims"),
      candidate.accessToken
    ).send({
      institution_id: institution.id,
      enrollment_id: "MISMATCH-1",
      requested_email: "attacker@example.com",
    });
    expect(res.status).toBe(403);
  });

  it("expires claims past their TTL", async () => {
    const { claim, candidate } = await setupClaim();
    const claimId = claim.body.data.claim.id;
    const otp = lastOtpFor("asha@nt.edu");

    await prisma.institutionMembershipClaim.update({
      where: { id: claimId },
      data: { otp_expires_at: new Date(Date.now() - 1000) },
    });

    const res = await bearer(
      request(app).post(`/api/v1/membership-claims/${claimId}/verify`),
      candidate.accessToken
    ).send({ otp });
    expect(res.status).toBe(410);

    const row = await prisma.institutionMembershipClaim.findUnique({
      where: { id: claimId },
    });
    expect(row.status).toBe("expired");
  });

  it("locks the claim after too many wrong attempts", async () => {
    const { claim, candidate } = await setupClaim();
    const claimId = claim.body.data.claim.id;
    const otp = lastOtpFor("asha@nt.edu");
    const wrongOtp = otp === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i += 1) {
      const res = await bearer(
        request(app).post(`/api/v1/membership-claims/${claimId}/verify`),
        candidate.accessToken
      ).send({ otp: wrongOtp });
      expect(res.status).toBe(400);
    }

    const row = await prisma.institutionMembershipClaim.findUnique({
      where: { id: claimId },
    });
    expect(row.status).toBe("locked");

    const correctAfterLock = await bearer(
      request(app).post(`/api/v1/membership-claims/${claimId}/verify`),
      candidate.accessToken
    ).send({ otp });
    expect(correctAfterLock.status).toBe(409);

    const mine = await bearer(
      request(app).get("/api/v1/membership-claims/mine"),
      candidate.accessToken
    );
    expect(mine.body.data.claims).toHaveLength(1);
  });

  it("re-requesting a code replaces the pending claim", async () => {
    const { institution, claim, candidate } = await setupClaim();
    const firstId = claim.body.data.claim.id;

    const again = await bearer(
      request(app).post("/api/v1/membership-claims"),
      candidate.accessToken
    ).send({
      institution_id: institution.id,
      enrollment_id: "CLAIM-1",
      requested_email: "asha@nt.edu",
    });
    expect(again.status).toBe(201);
    expect(again.body.data.claim.id).toBe(firstId);

    const pending = await prisma.institutionMembershipClaim.count({
      where: { status: "pending" },
    });
    expect(pending).toBe(1);
  });

  it("employers cannot create institution membership claims", async () => {
    const { institution } = await setupInstitution();
    const employer = await registerUser({
      role: "employer",
      extra: { organization: { name: "Somewhere Ltd" } },
    });

    const res = await bearer(
      request(app).post("/api/v1/membership-claims"),
      employer.accessToken
    ).send({
      institution_id: institution.id,
      enrollment_id: "X",
      requested_email: "x@example.com",
    });
    expect(res.status).toBe(403);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import {
  app,
  prisma,
  resetDb,
  registerUser,
  makeAdmin,
  bearer,
} from "./helpers/index.js";

beforeEach(resetDb);

async function setupInstituteDrive({
  drive: driveOverrides = {},
  membership: membershipOverrides = {},
} = {}) {
  const institute = await registerUser({
    role: "institute",
    extra: { institution: { name: "National Tech", code: "NT-1" } },
  });
  const institution = await prisma.institution.findUnique({
    where: { code: "NT-1" },
  });
  const admin = await makeAdmin();
  await bearer(
    request(app).post(`/api/v1/admin/institutions/${institution.id}/verify`),
    admin.accessToken
  );

  const candidate = await registerUser();
  const membership = await prisma.institutionMembership.create({
    data: {
      institution_id: institution.id,
      enrollment_id: "ENR-1",
      full_name: "Test Candidate",
      institutional_email: candidate.email,
      department: "CSE",
      batch: "2026",
      cgpa: 8.5,
      backlog_count: 0,
      user_id: candidate.user.id,
      verification_status: "verified",
      verification_source: "institute",
      verified_at: new Date(),
      ...membershipOverrides,
    },
  });

  const create = await bearer(
    request(app).post(`/api/v1/institutions/${institution.id}/drives`),
    institute.accessToken
  ).send({
    title: "2026 Campus Drive",
    min_cgpa: 7,
    max_backlogs: 0,
    eligible_batch: "2026",
    departments: ["CSE"],
    ...driveOverrides,
  });
  expect(create.status).toBe(201);
  const drive = create.body.data.drive;

  const open = await bearer(
    request(app).post(`/api/v1/drives/${drive.id}/open`),
    institute.accessToken
  );
  expect(open.status).toBe(200);

  return { institute, institution, admin, candidate, membership, drive };
}

describe("drive visibility & eligibility", () => {
  it("shows open drives to eligible members with computed eligibility", async () => {
    const { candidate, drive } = await setupInstituteDrive();

    const list = await bearer(
      request(app).get("/api/v1/drives"),
      candidate.accessToken
    );
    expect(list.status).toBe(200);
    expect(list.body.data.drives).toHaveLength(1);
    expect(list.body.data.drives[0].eligibility.eligible).toBe(true);

    const detail = await bearer(
      request(app).get(`/api/v1/drives/${drive.id}`),
      candidate.accessToken
    );
    expect(detail.status).toBe(200);
    expect(detail.body.data.eligibility.eligible).toBe(true);
  });

  it("flags ineligible candidates with reasons and never blocks application", async () => {
    const { candidate, drive } = await setupInstituteDrive({
      membership: { cgpa: 6.0 },
    });

    const detail = await bearer(
      request(app).get(`/api/v1/drives/${drive.id}`),
      candidate.accessToken
    );
    expect(detail.body.data.eligibility.eligible).toBe(false);
    expect(detail.body.data.eligibility.reasons).toContain(
      "cgpa_below_minimum"
    );

    const applied = await bearer(
      request(app).post(`/api/v1/drives/${drive.id}/applications`),
      candidate.accessToken
    );
    expect(applied.status).toBe(201);
    expect(applied.body.data.application.eligibility_status).toBe(
      "not_eligible"
    );
  });

  it("checks department, batch and backlog criteria", async () => {
    const { candidate, drive } = await setupInstituteDrive({
      membership: { department: "ECE", batch: "2025", backlog_count: 2 },
    });

    const detail = await bearer(
      request(app).get(`/api/v1/drives/${drive.id}`),
      candidate.accessToken
    );
    const reasons = detail.body.data.eligibility.reasons;
    expect(reasons).toContain("department_not_eligible");
    expect(reasons).toContain("batch_not_eligible");
    expect(reasons).toContain("too_many_backlogs");
  });

  it("hides drives from non-members and blocks their applications", async () => {
    const { drive } = await setupInstituteDrive();
    const outsider = await registerUser();

    const detail = await bearer(
      request(app).get(`/api/v1/drives/${drive.id}`),
      outsider.accessToken
    );
    expect(detail.status).toBe(404);

    const apply = await bearer(
      request(app).post(`/api/v1/drives/${drive.id}/applications`),
      outsider.accessToken
    );
    expect(apply.status).toBe(403);
  });

  it("respects the application window", async () => {
    const { candidate, drive } = await setupInstituteDrive({
      drive: { application_deadline: new Date(Date.now() - 60_000) },
    });

    const apply = await bearer(
      request(app).post(`/api/v1/drives/${drive.id}/applications`),
      candidate.accessToken
    );
    expect(apply.status).toBe(409);

    const list = await bearer(
      request(app).get("/api/v1/drives"),
      candidate.accessToken
    );
    expect(list.body.data.drives).toHaveLength(0);
  });
});

describe("drive candidate pipeline", () => {
  it("moves candidates applied -> shortlisted -> selected with timestamps", async () => {
    const { institute, candidate, drive } = await setupInstituteDrive();
    const applied = await bearer(
      request(app).post(`/api/v1/drives/${drive.id}/applications`),
      candidate.accessToken
    );
    const applicationId = applied.body.data.application.id;

    const move = (status) =>
      bearer(
        request(app).patch(
          `/api/v1/drives/drive-candidates/${applicationId}/status`
        ),
        institute.accessToken
      ).send({ status });

    const straightToSelected = await move("selected");
    expect(straightToSelected.status).toBe(409);

    const shortlist = await move("shortlisted");
    expect(shortlist.status).toBe(200);
    expect(shortlist.body.data.application.shortlisted_at).not.toBeNull();

    const select = await move("selected");
    expect(select.status).toBe(200);
    expect(select.body.data.application.selected_at).not.toBeNull();

    const afterTerminal = await move("rejected");
    expect(afterTerminal.status).toBe(409);

    const list = await bearer(
      request(app).get(`/api/v1/drives/${drive.id}/candidates`),
      institute.accessToken
    );
    expect(list.body.data.candidates).toHaveLength(1);
  });

  it("lets candidates withdraw while applied or shortlisted only", async () => {
    const { institute, candidate, drive } = await setupInstituteDrive();
    const applied = await bearer(
      request(app).post(`/api/v1/drives/${drive.id}/applications`),
      candidate.accessToken
    );
    const applicationId = applied.body.data.application.id;

    await bearer(
      request(app).patch(
        `/api/v1/drives/drive-candidates/${applicationId}/status`
      ),
      institute.accessToken
    ).send({ status: "shortlisted" });

    const withdraw = await bearer(
      request(app).post(
        `/api/v1/drives/drive-candidates/${applicationId}/withdraw`
      ),
      candidate.accessToken
    );
    expect(withdraw.status).toBe(200);
    expect(withdraw.body.data.application.status).toBe("withdrawn");

    const mine = await bearer(
      request(app).get("/api/v1/drives/mine"),
      candidate.accessToken
    );
    expect(mine.body.data.applications).toHaveLength(1);
  });

  it("keeps drive management inside the owning institution", async () => {
    const { drive } = await setupInstituteDrive();
    const otherInstitute = await registerUser({
      role: "institute",
      extra: { institution: { name: "Rival College", code: "RC-1" } },
    });
    const admin = await makeAdmin();
    const other = await prisma.institution.findUnique({
      where: { code: "RC-1" },
    });
    await bearer(
      request(app).post(`/api/v1/admin/institutions/${other.id}/verify`),
      admin.accessToken
    );

    const res = await bearer(
      request(app).post(`/api/v1/drives/${drive.id}/close`),
      otherInstitute.accessToken
    );
    expect(res.status).toBe(403);
  });

  it("supports replacing departments, jobs and assessments as a unit", async () => {
    const { institute, drive } = await setupInstituteDrive();

    const departments = await bearer(
      request(app).put(`/api/v1/drives/${drive.id}/departments`),
      institute.accessToken
    ).send({ departments: ["CSE", "IT"] });
    expect(departments.status).toBe(200);
    expect(departments.body.data.departments).toHaveLength(2);

    const duplicateDept = await bearer(
      request(app).put(`/api/v1/drives/${drive.id}/departments`),
      institute.accessToken
    ).send({ departments: ["CSE", "cse"] });
    expect(duplicateDept.status).toBe(422);

    const bogusJobs = await bearer(
      request(app).put(`/api/v1/drives/${drive.id}/jobs`),
      institute.accessToken
    ).send({ job_ids: ["5c8f2f4e-1f1e-4a1e-9e45-000000000000"] });
    expect(bogusJobs.status).toBe(422);
  });
});

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

async function setupPublishedJob({ deadline = null } = {}) {
  const employer = await registerUser({
    role: "employer",
    extra: { organization: { name: "Acme Corp" } },
  });
  const organization = await prisma.organization.findFirst();
  const admin = await makeAdmin();
  await bearer(
    request(app).post(`/api/v1/admin/organizations/${organization.id}/verify`),
    admin.accessToken
  );

  const jobRes = await bearer(
    request(app).post(`/api/v1/organizations/${organization.id}/jobs`),
    employer.accessToken
  ).send({
    title: "Backend Engineer",
    description: "Node & Postgres",
    application_deadline: deadline,
  });
  expect(jobRes.status).toBe(201);
  const job = jobRes.body.data.job;

  const publish = await bearer(
    request(app).post(`/api/v1/jobs/${job.id}/publish`),
    employer.accessToken
  );
  expect(publish.status).toBe(200);

  return { employer, organization, job, admin };
}

function applyTo(jobId, candidate, payload = {}) {
  return bearer(
    request(app).post(`/api/v1/jobs/${jobId}/applications`),
    candidate.accessToken
  ).send(payload);
}

describe("job applications", () => {
  it("supports apply, duplicate prevention, candidate listing and employer view", async () => {
    const { job, employer } = await setupPublishedJob();
    const candidate = await registerUser();

    const applied = await applyTo(job.id, candidate, { cover_note: "Hire me" });
    expect(applied.status).toBe(201);
    expect(applied.body.data.application.source).toBe("self_applied");
    expect(applied.body.data.application.status).toBe("applied");

    const duplicate = await applyTo(job.id, candidate);
    expect(duplicate.status).toBe(409);

    const mine = await bearer(
      request(app).get("/api/v1/applications/mine"),
      candidate.accessToken
    );
    expect(mine.body.data.applications).toHaveLength(1);

    const employerView = await bearer(
      request(app).get(`/api/v1/jobs/${job.id}/applications`),
      employer.accessToken
    );
    expect(employerView.body.data.applications).toHaveLength(1);
    expect(employerView.body.data.applications[0].cover_note).toBe("Hire me");
  });

  it("lets candidates withdraw only from applied/shortlisted", async () => {
    const { job } = await setupPublishedJob();
    const candidate = await registerUser();
    const applied = await applyTo(job.id, candidate);
    const applicationId = applied.body.data.application.id;

    const withdraw = await bearer(
      request(app).post(`/api/v1/applications/${applicationId}/withdraw`),
      candidate.accessToken
    );
    expect(withdraw.status).toBe(200);
    expect(withdraw.body.data.application.status).toBe("withdrawn");

    const again = await bearer(
      request(app).post(`/api/v1/applications/${applicationId}/withdraw`),
      candidate.accessToken
    );
    expect(again.status).toBe(409);
  });

  it("enforces the employer transition matrix", async () => {
    const { job, employer } = await setupPublishedJob();
    const candidate = await registerUser();
    const applied = await applyTo(job.id, candidate);
    const applicationId = applied.body.data.application.id;

    const move = (status) =>
      bearer(
        request(app).patch(`/api/v1/applications/${applicationId}/status`),
        employer.accessToken
      ).send({ status });

    const skip = await move("selected");
    expect(skip.status).toBe(409);

    const shortlist = await move("shortlisted");
    expect(shortlist.status).toBe(200);

    const select = await move("selected");
    expect(select.status).toBe(200);

    const afterTerminal = await move("rejected");
    expect(afterTerminal.status).toBe(409);
  });

  it("blocks applications to closed windows and unpublished jobs", async () => {
    const { job, organization, employer } = await setupPublishedJob({
      deadline: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    const candidate = await registerUser();

    const missed = await applyTo(job.id, candidate);
    expect(missed.status).toBe(409);
    expect(missed.body.message).toMatch(/deadline/i);

    const draft = await bearer(
      request(app).post(`/api/v1/organizations/${organization.id}/jobs`),
      employer.accessToken
    ).send({ title: "Hidden draft" });
    const draftApply = await applyTo(draft.body.data.job.id, candidate);
    expect(draftApply.status).toBe(404);
  });

  it("hides jobs of suspended organizations", async () => {
    const { job, organization, admin, employer } = await setupPublishedJob();
    const candidate = await registerUser();

    await bearer(
      request(app).post(
        `/api/v1/admin/organizations/${organization.id}/suspend`
      ),
      admin.accessToken
    );

    const browse = await bearer(
      request(app).get("/api/v1/jobs"),
      candidate.accessToken
    );
    expect(browse.body.data.items).toHaveLength(0);

    const blocked = await applyTo(job.id, candidate);
    expect(blocked.status).toBe(404);

    const direct = await bearer(
      request(app).get(`/api/v1/jobs/${job.id}`),
      candidate.accessToken
    );
    expect(direct.status).toBe(403);
    expect(employer.accessToken).toBeTruthy();
  });

  it("supports employer invitations and rejects duplicates", async () => {
    const { job, employer } = await setupPublishedJob();
    const candidate = await registerUser();
    const profile = await prisma.candidateProfile.findUnique({
      where: { user_id: candidate.user.id },
    });

    const invite = await bearer(
      request(app).post(`/api/v1/jobs/${job.id}/invitations`),
      employer.accessToken
    ).send({ candidate_profile_id: profile.id });
    expect(invite.status).toBe(201);
    expect(invite.body.data.application.source).toBe("invited");
    expect(invite.body.data.application.status).toBe("applied");

    const again = await bearer(
      request(app).post(`/api/v1/jobs/${job.id}/invitations`),
      employer.accessToken
    ).send({ candidate_profile_id: profile.id });
    expect(again.status).toBe(409);
  });

  it("restricts application detail to the owner and hiring organization", async () => {
    const { job } = await setupPublishedJob();
    const candidate = await registerUser();
    const outsider = await registerUser();
    const applied = await applyTo(job.id, candidate);
    const applicationId = applied.body.data.application.id;

    const owner = await bearer(
      request(app).get(`/api/v1/applications/${applicationId}`),
      candidate.accessToken
    );
    expect(owner.status).toBe(200);

    const blocked = await bearer(
      request(app).get(`/api/v1/applications/${applicationId}`),
      outsider.accessToken
    );
    expect(blocked.status).toBe(403);
  });
});

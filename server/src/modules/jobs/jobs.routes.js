import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, optionalAuth } from "../../middleware/authenticate.js";
import { assertJobAccess } from "../../services/access.js";
import { parsePagination, paginatedData } from "../../utils/pagination.js";
import { idParam } from "../candidates/candidates.schemas.js";
import {
  jobUpdateSchema,
  jobSkillsPutSchema,
  jobAssessmentsPutSchema,
  jobListQuerySchema,
  applicationCreateSchema,
  invitationCreateSchema,
} from "./jobs.schemas.js";
import { getProfileForUser } from "../candidates/candidates.service.js";

const router = Router();

function publishedJobWhere(extra = {}) {
  return {
    status: "published",
    organization: { status: "active" },
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Browse (authenticated)
// ---------------------------------------------------------------------------

router.get(
  "/",
  authenticate,
  validate({ query: jobListQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = parsePagination(req.validatedQuery);
    const { search, location } = req.validatedQuery;

    const where = publishedJobWhere({
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(location
        ? { location: { contains: location, mode: "insensitive" } }
        : {}),
    });

    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          organization: {
            select: { id: true, name: true, logo_url: true, location: true },
          },
          skills: { include: { skill: true } },
        },
        orderBy: { published_at: "desc" },
        skip,
        take,
      }),
      prisma.job.count({ where }),
    ]);
    return sendSuccess(res, { data: paginatedData(items, total, page, limit) });
  })
);

router.get(
  "/:jobId",
  optionalAuth,
  validate({ params: idParam("jobId") }),
  asyncHandler(async (req, res) => {
    const job = await prisma.job.findUnique({
      where: { id: req.params.jobId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logo_url: true,
            location: true,
            status: true,
          },
        },
        skills: { include: { skill: true } },
        assessments: {
          include: {
            assessment: {
              select: {
                id: true,
                title: true,
                assessment_type: true,
                difficulty: true,
                duration_minutes: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!job) throw new ApiError(404, "Job not found");

    const isPublic =
      job.status === "published" && job.organization.status === "active";
    if (!isPublic) {
      await assertJobAccess(req.auth?.user.id, job.id);
    }
    return sendSuccess(res, { data: { job } });
  })
);

// ---------------------------------------------------------------------------
// Employer management (job-scoped; organization-scoped creation/listing lives
// in the organizations module: POST/GET /api/v1/organizations/:id/jobs)
// ---------------------------------------------------------------------------

router.patch(
  "/:jobId",
  authenticate,
  validate({ params: idParam("jobId"), body: jobUpdateSchema }),
  asyncHandler(async (req, res) => {
    const { job } = await assertJobAccess(req.auth.user.id, req.params.jobId, {
      roles: ["owner", "admin"],
    });
    const updated = await prisma.job.update({
      where: { id: job.id },
      data: req.body,
    });
    return sendSuccess(res, { message: "Job updated", data: { job: updated } });
  })
);

router.post(
  "/:jobId/publish",
  authenticate,
  validate({ params: idParam("jobId") }),
  asyncHandler(async (req, res) => {
    const { job } = await assertJobAccess(req.auth.user.id, req.params.jobId, {
      roles: ["owner", "admin"],
    });
    if (job.status === "archived") {
      throw new ApiError(409, "Archived jobs cannot be published");
    }
    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "published",
        published_at: job.published_at ?? new Date(),
      },
    });
    return sendSuccess(res, {
      message: "Job published",
      data: { job: updated },
    });
  })
);

router.post(
  "/:jobId/close",
  authenticate,
  validate({ params: idParam("jobId") }),
  asyncHandler(async (req, res) => {
    const { job } = await assertJobAccess(req.auth.user.id, req.params.jobId, {
      roles: ["owner", "admin"],
    });
    const updated = await prisma.job.update({
      where: { id: job.id },
      data: { status: "closed" },
    });
    return sendSuccess(res, { message: "Job closed", data: { job: updated } });
  })
);

router.put(
  "/:jobId/skills",
  authenticate,
  validate({ params: idParam("jobId"), body: jobSkillsPutSchema }),
  asyncHandler(async (req, res) => {
    const { job } = await assertJobAccess(req.auth.user.id, req.params.jobId, {
      roles: ["owner", "admin"],
    });
    const { skills } = req.body;

    if (skills.length > 0) {
      const skillIds = skills.map((skill) => skill.skill_id);
      const existing = await prisma.skill.count({
        where: { id: { in: skillIds }, status: "active" },
      });
      if (existing !== new Set(skillIds).size) {
        throw new ApiError(
          422,
          "One or more skills do not exist or are archived"
        );
      }
      if (new Set(skillIds).size !== skillIds.length) {
        throw new ApiError(422, "Duplicate skill_id entries are not allowed");
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.jobSkill.deleteMany({ where: { job_id: job.id } });
      if (skills.length > 0) {
        await tx.jobSkill.createMany({
          data: skills.map((skill) => ({ ...skill, job_id: job.id })),
        });
      }
      return tx.jobSkill.findMany({
        where: { job_id: job.id },
        include: { skill: true },
      });
    });
    return sendSuccess(res, {
      message: "Job skills updated",
      data: { skills: created },
    });
  })
);

router.put(
  "/:jobId/assessments",
  authenticate,
  validate({ params: idParam("jobId"), body: jobAssessmentsPutSchema }),
  asyncHandler(async (req, res) => {
    const { job } = await assertJobAccess(req.auth.user.id, req.params.jobId, {
      roles: ["owner", "admin"],
    });
    const { assessments } = req.body;

    if (
      new Set(assessments.map((a) => a.assessment_id)).size !==
      assessments.length
    ) {
      throw new ApiError(
        422,
        "Duplicate assessment_id entries are not allowed"
      );
    }
    if (assessments.length > 0) {
      const existing = await prisma.assessment.count({
        where: {
          id: { in: assessments.map((a) => a.assessment_id) },
          status: "active",
        },
      });
      if (existing !== assessments.length) {
        throw new ApiError(
          422,
          "One or more assessments do not exist or are not active"
        );
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.jobAssessment.deleteMany({ where: { job_id: job.id } });
      if (assessments.length > 0) {
        await tx.jobAssessment.createMany({
          data: assessments.map((a) => ({ ...a, job_id: job.id })),
        });
      }
      return tx.jobAssessment.findMany({
        where: { job_id: job.id },
        include: {
          assessment: {
            select: { id: true, title: true, assessment_type: true },
          },
        },
      });
    });
    return sendSuccess(res, {
      message: "Job assessments updated",
      data: { assessments: created },
    });
  })
);

// ---------------------------------------------------------------------------
// Applications received by this job (employer view)
// ---------------------------------------------------------------------------

router.get(
  "/:jobId/applications",
  authenticate,
  validate({ params: idParam("jobId") }),
  asyncHandler(async (req, res) => {
    const { job } = await assertJobAccess(req.auth.user.id, req.params.jobId, {
      roles: ["owner", "admin", "member"],
    });
    const applications = await prisma.jobApplication.findMany({
      where: { job_id: job.id },
      include: {
        candidate_profile: {
          include: { user: { select: { full_name: true, avatar_url: true } } },
        },
      },
      orderBy: { applied_at: "desc" },
    });
    return sendSuccess(res, { data: { applications } });
  })
);

router.post(
  "/:jobId/invitations",
  authenticate,
  validate({ params: idParam("jobId"), body: invitationCreateSchema }),
  asyncHandler(async (req, res) => {
    const { job } = await assertJobAccess(req.auth.user.id, req.params.jobId, {
      roles: ["owner", "admin", "member"],
    });
    if (job.status === "archived") {
      throw new ApiError(409, "Cannot invite candidates to an archived job");
    }

    const profile = await prisma.candidateProfile.findUnique({
      where: { id: req.body.candidate_profile_id },
    });
    if (!profile) throw new ApiError(404, "Candidate profile not found");

    const application = await prisma.jobApplication.create({
      data: {
        job_id: job.id,
        candidate_profile_id: profile.id,
        source: "invited",
        status: "applied",
        invited_by_user_id: req.auth.user.id,
      },
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Candidate invited",
      data: { application },
    });
  })
);

// ---------------------------------------------------------------------------
// Candidate applies
// ---------------------------------------------------------------------------

router.post(
  "/:jobId/applications",
  authenticate,
  validate({ params: idParam("jobId"), body: applicationCreateSchema }),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);

    const job = await prisma.job.findUnique({
      where: { id: req.params.jobId },
      include: { organization: { select: { status: true } } },
    });
    if (
      !job ||
      job.status !== "published" ||
      job.organization.status !== "active"
    ) {
      throw new ApiError(404, "Job not found");
    }
    if (job.application_deadline && job.application_deadline < new Date()) {
      throw new ApiError(409, "The application deadline has passed");
    }

    const existing = await prisma.jobApplication.findUnique({
      where: {
        job_id_candidate_profile_id: {
          job_id: job.id,
          candidate_profile_id: profile.id,
        },
      },
    });
    if (existing) {
      throw new ApiError(409, "You have already applied to this job");
    }

    const application = await prisma.jobApplication.create({
      data: {
        job_id: job.id,
        candidate_profile_id: profile.id,
        source: "self_applied",
        resume_url: req.body.resume_url ?? profile.resume_url,
        cover_note: req.body.cover_note ?? null,
      },
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Application submitted",
      data: { application },
    });
  })
);

export default router;

import { Router } from "express";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/authorize.js";
import { constantTimeEqual } from "../../utils/tokens.js";
import { evaluateAttempt } from "../../services/scoring.js";
import { parsePagination, paginatedData } from "../../utils/pagination.js";
import { getProfileForUser } from "../candidates/candidates.service.js";
import { idParam } from "../candidates/candidates.schemas.js";
import {
  assessmentCreateSchema,
  assessmentUpdateSchema,
  assessmentListQuerySchema,
  attemptCreateSchema,
  attemptEvaluateSchema,
} from "./assessments.schemas.js";

const router = Router();

// NOTE: `authenticate` is applied per-route (not router-wide) because the
// evaluation endpoint also accepts the raw assessment-engine token, which is
// not a JWT and would fail bearer authentication.

// Platform admin JWT OR the assessment-engine bearer token (constant-time).
function engineTokenOrAdmin(req, res, next) {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (
    token &&
    env.assessmentEngineToken &&
    constantTimeEqual(token, env.assessmentEngineToken)
  ) {
    req.auth = { via: "engine", user: null };
    return next();
  }
  return authenticate(req, res, (err) => {
    if (err) return next(err);
    requireRole("admin")(req, res, next);
  });
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

router.get(
  "/",
  authenticate,
  validate({ query: assessmentListQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = parsePagination(req.validatedQuery);
    const { assessment_type, search } = req.validatedQuery;
    const isAdmin = req.auth.user?.role === "admin";

    const status = isAdmin ? req.validatedQuery.status : "active";
    const where = {
      ...(status ? { status } : {}),
      ...(assessment_type ? { assessment_type } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.assessment.findMany({
        where,
        include: { skills: { include: { skill: true } } },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.assessment.count({ where }),
    ]);
    return sendSuccess(res, { data: paginatedData(items, total, page, limit) });
  })
);

router.post(
  "/",
  authenticate,
  requireRole("admin"),
  validate({ body: assessmentCreateSchema }),
  asyncHandler(async (req, res) => {
    const { skills, ...data } = req.body;
    if (new Set(skills.map((skill) => skill.skill_id)).size !== skills.length) {
      throw new ApiError(422, "Duplicate skill_id entries are not allowed");
    }

    const assessment = await prisma.$transaction(async (tx) => {
      const created = await tx.assessment.create({ data });
      await tx.assessmentSkill.createMany({
        data: skills.map((skill) => ({ ...skill, assessment_id: created.id })),
      });
      return tx.assessment.findUnique({
        where: { id: created.id },
        include: { skills: { include: { skill: true } } },
      });
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Assessment created",
      data: { assessment },
    });
  })
);

router.get(
  "/:assessmentId",
  authenticate,
  validate({ params: idParam("assessmentId") }),
  asyncHandler(async (req, res) => {
    const assessment = await prisma.assessment.findUnique({
      where: { id: req.params.assessmentId },
      include: { skills: { include: { skill: true } } },
    });
    if (!assessment) throw new ApiError(404, "Assessment not found");

    const isAdmin = req.auth.user?.role === "admin";
    if (!isAdmin && assessment.status !== "active") {
      throw new ApiError(404, "Assessment not found");
    }
    return sendSuccess(res, { data: { assessment } });
  })
);

router.patch(
  "/:assessmentId",
  authenticate,
  requireRole("admin"),
  validate({ params: idParam("assessmentId"), body: assessmentUpdateSchema }),
  asyncHandler(async (req, res) => {
    const { skills, ...data } = req.body;

    if (skills) {
      if (
        new Set(skills.map((skill) => skill.skill_id)).size !== skills.length
      ) {
        throw new ApiError(422, "Duplicate skill_id entries are not allowed");
      }
      const activeSkills = await prisma.skill.count({
        where: { id: { in: skills.map((s) => s.skill_id) }, status: "active" },
      });
      if (activeSkills !== new Set(skills.map((s) => s.skill_id)).size) {
        throw new ApiError(
          422,
          "One or more skills do not exist or are archived"
        );
      }
    }

    const assessment = await prisma.$transaction(async (tx) => {
      await tx.assessment.update({
        where: { id: req.params.assessmentId },
        data,
      });
      if (skills) {
        await tx.assessmentSkill.deleteMany({
          where: { assessment_id: req.params.assessmentId },
        });
        await tx.assessmentSkill.createMany({
          data: skills.map((skill) => ({
            ...skill,
            assessment_id: req.params.assessmentId,
          })),
        });
      }
      return tx.assessment.findUnique({
        where: { id: req.params.assessmentId },
        include: { skills: { include: { skill: true } } },
      });
    });
    return sendSuccess(res, {
      message: "Assessment updated",
      data: { assessment },
    });
  })
);

// ---------------------------------------------------------------------------
// Candidate attempts
// ---------------------------------------------------------------------------

router.get(
  "/attempts/mine",
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);
    const attempts = await prisma.assessmentAttempt.findMany({
      where: { candidate_profile_id: profile.id },
      include: {
        assessment: {
          select: { id: true, title: true, assessment_type: true },
        },
      },
      orderBy: { created_at: "desc" },
    });
    return sendSuccess(res, { data: { attempts } });
  })
);

router.post(
  "/:assessmentId/attempts",
  authenticate,
  validate({ params: idParam("assessmentId"), body: attemptCreateSchema }),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);

    const assessment = await prisma.assessment.findUnique({
      where: { id: req.params.assessmentId },
    });
    if (!assessment || assessment.status !== "active") {
      throw new ApiError(404, "Assessment not found");
    }

    const { job_application_id, placement_drive_candidate_id } = req.body;

    if (job_application_id) {
      const application = await prisma.jobApplication.findUnique({
        where: { id: job_application_id },
      });
      if (!application || application.candidate_profile_id !== profile.id) {
        throw new ApiError(404, "Job application not found");
      }
    }
    if (placement_drive_candidate_id) {
      const driveCandidate = await prisma.placementDriveCandidate.findUnique({
        where: { id: placement_drive_candidate_id },
      });
      if (
        !driveCandidate ||
        driveCandidate.candidate_profile_id !== profile.id
      ) {
        throw new ApiError(404, "Placement drive application not found");
      }
    }

    const openAttempt = await prisma.assessmentAttempt.findFirst({
      where: {
        assessment_id: assessment.id,
        candidate_profile_id: profile.id,
        result_status: "pending",
      },
    });
    if (openAttempt) {
      throw new ApiError(
        409,
        "You already have an open attempt for this assessment"
      );
    }

    const lastAttempt = await prisma.assessmentAttempt.findFirst({
      where: { assessment_id: assessment.id, candidate_profile_id: profile.id },
      orderBy: { attempt_number: "desc" },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        assessment_id: assessment.id,
        candidate_profile_id: profile.id,
        attempt_number: (lastAttempt?.attempt_number ?? 0) + 1,
        job_application_id: job_application_id ?? null,
        placement_drive_candidate_id: placement_drive_candidate_id ?? null,
      },
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Attempt started",
      data: { attempt },
    });
  })
);

async function loadAttemptForCandidate(req) {
  const profile = await getProfileForUser(req.auth.user.id);
  const attempt = await prisma.assessmentAttempt.findFirst({
    where: { id: req.params.attemptId, candidate_profile_id: profile.id },
    include: {
      assessment: { include: { skills: { include: { skill: true } } } },
    },
  });
  if (!attempt) throw new ApiError(404, "Attempt not found");
  return attempt;
}

router.get(
  "/attempts/:attemptId",
  authenticate,
  validate({ params: idParam("attemptId") }),
  asyncHandler(async (req, res) => {
    if (req.auth.user?.role === "admin") {
      const attempt = await prisma.assessmentAttempt.findUnique({
        where: { id: req.params.attemptId },
        include: { assessment: true },
      });
      if (!attempt) throw new ApiError(404, "Attempt not found");
      return sendSuccess(res, { data: { attempt } });
    }
    const attempt = await loadAttemptForCandidate(req);
    return sendSuccess(res, { data: { attempt } });
  })
);

router.post(
  "/attempts/:attemptId/submit",
  authenticate,
  validate({ params: idParam("attemptId") }),
  asyncHandler(async (req, res) => {
    const attempt = await loadAttemptForCandidate(req);
    if (attempt.result_status !== "pending") {
      throw new ApiError(409, "Only pending attempts can be submitted");
    }
    if (attempt.submitted_at) {
      throw new ApiError(409, "Attempt has already been submitted");
    }
    const updated = await prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: { submitted_at: new Date() },
    });
    return sendSuccess(res, {
      message: "Attempt submitted",
      data: { attempt: updated },
    });
  })
);

router.post(
  "/attempts/:attemptId/abandon",
  authenticate,
  validate({ params: idParam("attemptId") }),
  asyncHandler(async (req, res) => {
    const attempt = await loadAttemptForCandidate(req);
    if (attempt.result_status !== "pending") {
      throw new ApiError(409, "Only pending attempts can be abandoned");
    }
    const updated = await prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: { result_status: "abandoned", evaluated_at: null },
    });
    return sendSuccess(res, {
      message: "Attempt abandoned",
      data: { attempt: updated },
    });
  })
);

// ---------------------------------------------------------------------------
// Evaluation (engine or platform admin)
// ---------------------------------------------------------------------------

router.post(
  "/attempts/:attemptId/evaluate",
  engineTokenOrAdmin,
  validate({ params: idParam("attemptId"), body: attemptEvaluateSchema }),
  asyncHandler(async (req, res) => {
    const attempt = await evaluateAttempt(
      prisma,
      req.params.attemptId,
      req.body.score
    );
    return sendSuccess(res, {
      message: "Attempt evaluated",
      data: { attempt },
    });
  })
);

export default router;

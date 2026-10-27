import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, optionalAuth } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/authorize.js";
import {
  assertDriveAccess,
  assertInstitutionAccess,
} from "../../services/access.js";
import { checkDriveEligibility } from "../../services/eligibility.js";
import { getProfileForUser } from "../candidates/candidates.service.js";
import { idParam } from "../candidates/candidates.schemas.js";
import {
  driveUpdateSchema,
  departmentsPutSchema,
  driveJobsPutSchema,
  driveAssessmentsPutSchema,
  driveCandidateStatusSchema,
} from "./drives.schemas.js";

const router = Router();

const INSTITUTE_ROLES = ["owner", "admin"];

function isWithinWindow(drive) {
  const now = new Date();
  if (drive.application_open_at && drive.application_open_at > now)
    return false;
  if (drive.application_deadline && drive.application_deadline < now)
    return false;
  return true;
}

async function membershipFor(userId, institutionId) {
  return prisma.institutionMembership.findFirst({
    where: { institution_id: institutionId, user_id: userId },
  });
}

// ---------------------------------------------------------------------------
// Candidate: browse open drives of own institutions
// ---------------------------------------------------------------------------

router.get(
  "/mine",
  authenticate,
  requireRole("candidate"),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);
    const driveCandidates = await prisma.placementDriveCandidate.findMany({
      where: { candidate_profile_id: profile.id },
      include: {
        placement_drive: {
          include: {
            institution: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { applied_at: "desc" },
    });
    return sendSuccess(res, { data: { applications: driveCandidates } });
  })
);

router.get(
  "/",
  authenticate,
  requireRole("candidate"),
  asyncHandler(async (req, res) => {
    const memberships = await prisma.institutionMembership.findMany({
      where: {
        user_id: req.auth.user.id,
        verification_status: "verified",
        institution: { status: "active" },
      },
    });
    if (memberships.length === 0) {
      return sendSuccess(res, { data: { drives: [] } });
    }

    const drives = await prisma.placementDrive.findMany({
      where: {
        institution_id: { in: memberships.map((m) => m.institution_id) },
        status: "open",
      },
      include: {
        institution: { select: { id: true, name: true, code: true } },
        departments: true,
      },
      orderBy: { created_at: "desc" },
    });

    const membershipByInstitution = new Map(
      memberships.map((membership) => [membership.institution_id, membership])
    );

    const annotated = drives.filter(isWithinWindow).map((drive) => {
      const membership = membershipByInstitution.get(drive.institution_id);
      const { eligible, reasons } = checkDriveEligibility(
        drive,
        membership,
        drive.departments
      );
      return { ...drive, eligibility: { eligible, reasons } };
    });

    return sendSuccess(res, { data: { drives: annotated } });
  })
);

router.get(
  "/:driveId",
  optionalAuth,
  validate({ params: idParam("driveId") }),
  asyncHandler(async (req, res) => {
    const drive = await prisma.placementDrive.findUnique({
      where: { id: req.params.driveId },
      include: {
        institution: {
          select: { id: true, name: true, code: true, status: true },
        },
        departments: true,
        jobs: {
          include: {
            job: {
              include: { organization: { select: { id: true, name: true } } },
            },
          },
        },
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
    if (!drive) throw new ApiError(404, "Placement drive not found");

    const viewer = req.auth;
    const isAdmin = viewer?.user.role === "admin";
    const instituteMember = viewer
      ? await prisma.institutionUser.findUnique({
          where: {
            institution_id_user_id: {
              institution_id: drive.institution_id,
              user_id: viewer.user.id,
            },
          },
        })
      : null;

    let membership = null;
    if (viewer?.user.role === "candidate") {
      membership = await membershipFor(viewer.user.id, drive.institution_id);
    }

    const canView =
      isAdmin ||
      (instituteMember && instituteMember.status === "active") ||
      Boolean(membership);

    if (!canView) throw new ApiError(404, "Placement drive not found");

    let eligibility = null;
    if (membership) {
      const result = checkDriveEligibility(
        drive,
        membership,
        drive.departments
      );
      eligibility = {
        ...result,
        membership_status: membership.membership_status,
      };
    }

    return sendSuccess(res, { data: { drive, eligibility } });
  })
);

// ---------------------------------------------------------------------------
// Candidate: apply / withdraw
// ---------------------------------------------------------------------------

router.post(
  "/:driveId/applications",
  authenticate,
  requireRole("candidate"),
  validate({ params: idParam("driveId") }),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);

    const drive = await prisma.placementDrive.findUnique({
      where: { id: req.params.driveId },
      include: { departments: true, institution: { select: { status: true } } },
    });
    if (
      !drive ||
      drive.status !== "open" ||
      drive.institution.status !== "active"
    ) {
      throw new ApiError(404, "Placement drive not found");
    }
    if (!isWithinWindow(drive)) {
      throw new ApiError(
        409,
        "The application window for this drive is not open"
      );
    }

    const membership = await membershipFor(
      req.auth.user.id,
      drive.institution_id
    );
    if (!membership) {
      throw new ApiError(403, "You are not a member of this institution");
    }

    const existing = await prisma.placementDriveCandidate.findUnique({
      where: {
        placement_drive_id_candidate_profile_id: {
          placement_drive_id: drive.id,
          candidate_profile_id: profile.id,
        },
      },
    });
    if (existing) {
      throw new ApiError(
        409,
        "You have already applied to this placement drive"
      );
    }

    const { eligible } = checkDriveEligibility(
      drive,
      membership,
      drive.departments
    );

    const application = await prisma.placementDriveCandidate.create({
      data: {
        placement_drive_id: drive.id,
        candidate_profile_id: profile.id,
        status: "applied",
        eligibility_status: eligible ? "eligible" : "not_eligible",
      },
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Placement drive application submitted",
      data: { application },
    });
  })
);

router.post(
  "/drive-candidates/:driveCandidateId/withdraw",
  authenticate,
  requireRole("candidate"),
  validate({ params: idParam("driveCandidateId") }),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);
    const application = await prisma.placementDriveCandidate.findFirst({
      where: {
        id: req.params.driveCandidateId,
        candidate_profile_id: profile.id,
      },
    });
    if (!application) throw new ApiError(404, "Application not found");
    if (!["applied", "shortlisted"].includes(application.status)) {
      throw new ApiError(
        409,
        `An application in status "${application.status}" cannot be withdrawn`
      );
    }
    const updated = await prisma.placementDriveCandidate.update({
      where: { id: application.id },
      data: { status: "withdrawn" },
    });
    return sendSuccess(res, {
      message: "Application withdrawn",
      data: { application: updated },
    });
  })
);

// ---------------------------------------------------------------------------
// Institute: manage the drive
// ---------------------------------------------------------------------------

router.patch(
  "/:driveId",
  authenticate,
  validate({ params: idParam("driveId"), body: driveUpdateSchema }),
  asyncHandler(async (req, res) => {
    const { drive } = await assertDriveAccess(
      req.auth.user.id,
      req.params.driveId,
      {
        roles: INSTITUTE_ROLES,
      }
    );
    const updated = await prisma.placementDrive.update({
      where: { id: drive.id },
      data: req.body,
    });
    return sendSuccess(res, {
      message: "Drive updated",
      data: { drive: updated },
    });
  })
);

router.post(
  "/:driveId/open",
  authenticate,
  validate({ params: idParam("driveId") }),
  asyncHandler(async (req, res) => {
    const { drive } = await assertDriveAccess(
      req.auth.user.id,
      req.params.driveId,
      {
        roles: INSTITUTE_ROLES,
      }
    );
    if (!["draft", "closed"].includes(drive.status)) {
      throw new ApiError(
        409,
        `A drive in status "${drive.status}" cannot be opened`
      );
    }
    const updated = await prisma.placementDrive.update({
      where: { id: drive.id },
      data: { status: "open" },
    });
    return sendSuccess(res, {
      message: "Drive opened",
      data: { drive: updated },
    });
  })
);

router.post(
  "/:driveId/close",
  authenticate,
  validate({ params: idParam("driveId") }),
  asyncHandler(async (req, res) => {
    const { drive } = await assertDriveAccess(
      req.auth.user.id,
      req.params.driveId,
      {
        roles: INSTITUTE_ROLES,
      }
    );
    const updated = await prisma.placementDrive.update({
      where: { id: drive.id },
      data: { status: "closed" },
    });
    return sendSuccess(res, {
      message: "Drive closed",
      data: { drive: updated },
    });
  })
);

router.put(
  "/:driveId/departments",
  authenticate,
  validate({ params: idParam("driveId"), body: departmentsPutSchema }),
  asyncHandler(async (req, res) => {
    const { drive } = await assertDriveAccess(
      req.auth.user.id,
      req.params.driveId,
      {
        roles: INSTITUTE_ROLES,
      }
    );
    const departments = await prisma.$transaction(async (tx) => {
      await tx.placementDriveDepartment.deleteMany({
        where: { placement_drive_id: drive.id },
      });
      if (req.body.departments.length > 0) {
        await tx.placementDriveDepartment.createMany({
          data: req.body.departments.map((department_name) => ({
            placement_drive_id: drive.id,
            department_name,
          })),
        });
      }
      return tx.placementDriveDepartment.findMany({
        where: { placement_drive_id: drive.id },
        orderBy: { department_name: "asc" },
      });
    });
    return sendSuccess(res, {
      message: "Departments updated",
      data: { departments },
    });
  })
);

router.put(
  "/:driveId/jobs",
  authenticate,
  validate({ params: idParam("driveId"), body: driveJobsPutSchema }),
  asyncHandler(async (req, res) => {
    const { drive } = await assertDriveAccess(
      req.auth.user.id,
      req.params.driveId,
      {
        roles: INSTITUTE_ROLES,
      }
    );
    const { job_ids } = req.body;

    if (job_ids.length > 0) {
      const jobs = await prisma.job.count({
        where: { id: { in: job_ids }, status: { not: "archived" } },
      });
      if (jobs !== job_ids.length) {
        throw new ApiError(
          422,
          "One or more jobs do not exist or are archived"
        );
      }
    }

    const jobs = await prisma.$transaction(async (tx) => {
      await tx.placementDriveJob.deleteMany({
        where: { placement_drive_id: drive.id },
      });
      if (job_ids.length > 0) {
        await tx.placementDriveJob.createMany({
          data: job_ids.map((job_id) => ({
            placement_drive_id: drive.id,
            job_id,
          })),
        });
      }
      return tx.placementDriveJob.findMany({
        where: { placement_drive_id: drive.id },
        include: { job: { select: { id: true, title: true, status: true } } },
      });
    });
    return sendSuccess(res, { message: "Drive jobs updated", data: { jobs } });
  })
);

router.put(
  "/:driveId/assessments",
  authenticate,
  validate({ params: idParam("driveId"), body: driveAssessmentsPutSchema }),
  asyncHandler(async (req, res) => {
    const { drive } = await assertDriveAccess(
      req.auth.user.id,
      req.params.driveId,
      {
        roles: INSTITUTE_ROLES,
      }
    );
    const { assessments } = req.body;

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
      await tx.placementDriveAssessment.deleteMany({
        where: { placement_drive_id: drive.id },
      });
      if (assessments.length > 0) {
        await tx.placementDriveAssessment.createMany({
          data: assessments.map((a) => ({
            ...a,
            placement_drive_id: drive.id,
          })),
        });
      }
      return tx.placementDriveAssessment.findMany({
        where: { placement_drive_id: drive.id },
        include: {
          assessment: {
            select: { id: true, title: true, assessment_type: true },
          },
        },
      });
    });
    return sendSuccess(res, {
      message: "Drive assessments updated",
      data: { assessments: created },
    });
  })
);

// ---------------------------------------------------------------------------
// Institute: manage candidates
// ---------------------------------------------------------------------------

router.get(
  "/:driveId/candidates",
  authenticate,
  validate({ params: idParam("driveId") }),
  asyncHandler(async (req, res) => {
    const { drive } = await assertDriveAccess(
      req.auth.user.id,
      req.params.driveId,
      {
        roles: ["owner", "admin", "member"],
      }
    );
    const candidates = await prisma.placementDriveCandidate.findMany({
      where: { placement_drive_id: drive.id },
      include: {
        candidate_profile: {
          include: {
            user: {
              select: { full_name: true, email: true, avatar_url: true },
            },
          },
        },
      },
      orderBy: { applied_at: "desc" },
    });
    return sendSuccess(res, { data: { candidates } });
  })
);

const DRIVE_CANDIDATE_TRANSITIONS = {
  applied: ["shortlisted", "rejected"],
  shortlisted: ["selected", "rejected"],
};

router.patch(
  "/drive-candidates/:driveCandidateId/status",
  authenticate,
  validate({
    params: idParam("driveCandidateId"),
    body: driveCandidateStatusSchema,
  }),
  asyncHandler(async (req, res) => {
    const application = await prisma.placementDriveCandidate.findUnique({
      where: { id: req.params.driveCandidateId },
      include: { placement_drive: true },
    });
    if (!application) throw new ApiError(404, "Application not found");

    await assertInstitutionAccess(
      req.auth.user.id,
      application.placement_drive.institution_id,
      {
        roles: ["owner", "admin"],
      }
    );

    const allowed = DRIVE_CANDIDATE_TRANSITIONS[application.status] ?? [];
    if (!allowed.includes(req.body.status)) {
      throw new ApiError(
        409,
        `Cannot move application from "${application.status}" to "${req.body.status}"`
      );
    }

    const now = new Date();
    const updated = await prisma.placementDriveCandidate.update({
      where: { id: application.id },
      data: {
        status: req.body.status,
        ...(req.body.status === "shortlisted" ? { shortlisted_at: now } : {}),
        ...(req.body.status === "selected" ? { selected_at: now } : {}),
      },
    });
    return sendSuccess(res, {
      message: "Application status updated",
      data: { application: updated },
    });
  })
);

export default router;

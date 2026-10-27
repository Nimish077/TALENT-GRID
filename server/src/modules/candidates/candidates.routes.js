import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, optionalAuth } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/authorize.js";
import { getProfileForUser, getPublicProfile } from "./candidates.service.js";
import {
  profileUpdateSchema,
  educationCreateSchema,
  educationUpdateSchema,
  experienceCreateSchema,
  experienceUpdateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  certificationCreateSchema,
  certificationUpdateSchema,
  candidateSkillCreateSchema,
  candidateSkillUpdateSchema,
  consentPutSchema,
  idParam,
} from "./candidates.schemas.js";

const router = Router();

// Everything under /me belongs to the authenticated candidate.
router.use("/me", authenticate, requireRole("candidate", "admin"));

// ---------------------------------------------------------------------------
// Own profile
// ---------------------------------------------------------------------------

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);
    const [
      educations,
      experiences,
      projects,
      certifications,
      skills,
      consents,
    ] = await Promise.all([
      prisma.candidateEducation.count({
        where: { candidate_profile_id: profile.id },
      }),
      prisma.candidateExperience.count({
        where: { candidate_profile_id: profile.id },
      }),
      prisma.candidateProject.count({
        where: { candidate_profile_id: profile.id },
      }),
      prisma.candidateCertification.count({
        where: { candidate_profile_id: profile.id },
      }),
      prisma.candidateSkill.count({
        where: { candidate_profile_id: profile.id },
      }),
      prisma.candidateConsent.count({
        where: { candidate_profile_id: profile.id },
      }),
    ]);
    return sendSuccess(res, {
      data: {
        profile,
        counts: {
          educations,
          experiences,
          projects,
          certifications,
          skills,
          consents,
        },
      },
    });
  })
);

router.patch(
  "/me",
  validate({ body: profileUpdateSchema }),
  asyncHandler(async (req, res) => {
    const profile = await prisma.candidateProfile.update({
      where: { user_id: req.auth.user.id },
      data: req.body,
    });
    return sendSuccess(res, { message: "Profile updated", data: { profile } });
  })
);

// ---------------------------------------------------------------------------
// Repeatable profile sections (educations / experiences / projects /
// certifications): identical ownership-scoped CRUD.
// ---------------------------------------------------------------------------

function buildOwnedSection({
  delegate,
  orderBy,
  createSchema,
  updateSchema,
  paramName,
}) {
  const section = Router();

  section.get(
    "/",
    asyncHandler(async (req, res) => {
      const profile = await getProfileForUser(req.auth.user.id);
      const items = await prisma[delegate].findMany({
        where: { candidate_profile_id: profile.id },
        orderBy,
      });
      return sendSuccess(res, { data: { items } });
    })
  );

  section.post(
    "/",
    validate({ body: createSchema }),
    asyncHandler(async (req, res) => {
      const profile = await getProfileForUser(req.auth.user.id);
      const item = await prisma[delegate].create({
        data: { ...req.body, candidate_profile_id: profile.id },
      });
      return sendSuccess(res, {
        statusCode: 201,
        message: "Created",
        data: { item },
      });
    })
  );

  section.patch(
    `/:${paramName}`,
    validate({ body: updateSchema, params: idParam(paramName) }),
    asyncHandler(async (req, res) => {
      const profile = await getProfileForUser(req.auth.user.id);
      const existing = await prisma[delegate].findFirst({
        where: { id: req.params[paramName], candidate_profile_id: profile.id },
      });
      if (!existing) throw new ApiError(404, "Record not found");
      const item = await prisma[delegate].update({
        where: { id: existing.id },
        data: req.body,
      });
      return sendSuccess(res, { message: "Updated", data: { item } });
    })
  );

  section.delete(
    `/:${paramName}`,
    validate({ params: idParam(paramName) }),
    asyncHandler(async (req, res) => {
      const profile = await getProfileForUser(req.auth.user.id);
      const existing = await prisma[delegate].findFirst({
        where: { id: req.params[paramName], candidate_profile_id: profile.id },
      });
      if (!existing) throw new ApiError(404, "Record not found");
      await prisma[delegate].delete({ where: { id: existing.id } });
      return sendSuccess(res, { message: "Deleted" });
    })
  );

  return section;
}

router.use(
  "/me/educations",
  buildOwnedSection({
    delegate: "candidateEducation",
    orderBy: { start_year: "desc" },
    createSchema: educationCreateSchema,
    updateSchema: educationUpdateSchema,
    paramName: "educationId",
  })
);

router.use(
  "/me/experiences",
  buildOwnedSection({
    delegate: "candidateExperience",
    orderBy: { start_date: "desc" },
    createSchema: experienceCreateSchema,
    updateSchema: experienceUpdateSchema,
    paramName: "experienceId",
  })
);

router.use(
  "/me/projects",
  buildOwnedSection({
    delegate: "candidateProject",
    orderBy: { created_at: "desc" },
    createSchema: projectCreateSchema,
    updateSchema: projectUpdateSchema,
    paramName: "projectId",
  })
);

router.use(
  "/me/certifications",
  buildOwnedSection({
    delegate: "candidateCertification",
    orderBy: { created_at: "desc" },
    createSchema: certificationCreateSchema,
    updateSchema: certificationUpdateSchema,
    paramName: "certificationId",
  })
);

// ---------------------------------------------------------------------------
// Skills: candidates manage declared_level only. verified_* is exclusively
// written by the scoring engine after a passed assessment.
// ---------------------------------------------------------------------------

router.get(
  "/me/skills",
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);
    const items = await prisma.candidateSkill.findMany({
      where: { candidate_profile_id: profile.id },
      include: { skill: true },
      orderBy: { created_at: "desc" },
    });
    return sendSuccess(res, { data: { items } });
  })
);

router.post(
  "/me/skills",
  validate({ body: candidateSkillCreateSchema }),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);

    let skillId = req.body.skill_id;
    if (!skillId) {
      let skill = await prisma.skill.findUnique({
        where: { name: req.body.skill_name },
      });
      if (!skill) {
        skill = await prisma.skill.create({
          data: { name: req.body.skill_name },
        });
      }
      if (skill.status !== "active") {
        throw new ApiError(409, "Skill is archived and cannot be added");
      }
      skillId = skill.id;
    } else {
      const skill = await prisma.skill.findUnique({ where: { id: skillId } });
      if (!skill || skill.status !== "active") {
        throw new ApiError(404, "Skill not found");
      }
    }

    const item = await prisma.candidateSkill.create({
      data: {
        candidate_profile_id: profile.id,
        skill_id: skillId,
        declared_level: req.body.declared_level,
      },
      include: { skill: true },
    });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Skill added",
      data: { item },
    });
  })
);

router.patch(
  "/me/skills/:candidateSkillId",
  validate({
    params: idParam("candidateSkillId"),
    body: candidateSkillUpdateSchema,
  }),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);
    const existing = await prisma.candidateSkill.findFirst({
      where: {
        id: req.params.candidateSkillId,
        candidate_profile_id: profile.id,
      },
    });
    if (!existing) throw new ApiError(404, "Skill not found");
    const item = await prisma.candidateSkill.update({
      where: { id: existing.id },
      data: { declared_level: req.body.declared_level },
      include: { skill: true },
    });
    return sendSuccess(res, { message: "Skill updated", data: { item } });
  })
);

router.delete(
  "/me/skills/:candidateSkillId",
  validate({ params: idParam("candidateSkillId") }),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);
    const existing = await prisma.candidateSkill.findFirst({
      where: {
        id: req.params.candidateSkillId,
        candidate_profile_id: profile.id,
      },
    });
    if (!existing) throw new ApiError(404, "Skill not found");
    await prisma.candidateSkill.delete({ where: { id: existing.id } });
    return sendSuccess(res, { message: "Skill removed" });
  })
);

// ---------------------------------------------------------------------------
// Consents
// ---------------------------------------------------------------------------

const consentParamSchema = z.object({
  consentType: z.string().trim().min(1).max(60),
});

router.get(
  "/me/consents",
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);
    const items = await prisma.candidateConsent.findMany({
      where: { candidate_profile_id: profile.id },
      orderBy: { created_at: "desc" },
    });
    return sendSuccess(res, { data: { items } });
  })
);

router.put(
  "/me/consents/:consentType",
  validate({ params: consentParamSchema, body: consentPutSchema }),
  asyncHandler(async (req, res) => {
    const profile = await getProfileForUser(req.auth.user.id);
    const { consentType } = req.params;
    const { granted, policy_version } = req.body;
    const now = new Date();

    const consent = await prisma.candidateConsent.upsert({
      where: {
        candidate_profile_id_consent_type: {
          candidate_profile_id: profile.id,
          consent_type: consentType,
        },
      },
      create: {
        candidate_profile_id: profile.id,
        consent_type: consentType,
        granted,
        policy_version,
        granted_at: granted ? now : null,
        revoked_at: granted ? null : now,
      },
      update: {
        granted,
        policy_version,
        granted_at: granted ? now : undefined,
        revoked_at: granted ? null : now,
      },
    });
    return sendSuccess(res, { message: "Consent recorded", data: { consent } });
  })
);

// ---------------------------------------------------------------------------
// Public profile (visibility-aware)
// ---------------------------------------------------------------------------

router.get(
  "/:candidateProfileId",
  optionalAuth,
  validate({ params: idParam("candidateProfileId") }),
  asyncHandler(async (req, res) => {
    const profile = await getPublicProfile(
      req.params.candidateProfileId,
      req.auth
    );
    return sendSuccess(res, { data: { profile } });
  })
);

export default router;

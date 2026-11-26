// Employer talent discovery.
//
//   GET /api/v1/talent                       ranked search by verified skills
//   GET /api/v1/talent/:candidateProfileId   profile + assessment evidence
//
// Matching counts VERIFIED skills only: a requirement is met when the candidate
// has passed an assessment at (or above) the required level. Skills a candidate
// merely claims are reported as "claimed" but never add to the match.

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/authorize.js";
import { parsePagination, paginatedData } from "../../utils/pagination.js";
import { idParam } from "../candidates/candidates.schemas.js";
import { LEVEL_RANK } from "../../services/scoring.js";

const router = Router();

router.use(authenticate, requireRole("employer", "admin"));

// Employers need an active membership in an active organization.
async function requireActiveEmployer(req, res, next) {
  try {
    if (req.auth.user.role === "admin") return next();
    const membership = await prisma.organizationUser.findFirst({
      where: {
        user_id: req.auth.user.id,
        status: "active",
        organization: { status: "active" },
      },
    });
    if (!membership) {
      throw new ApiError(
        403,
        "Talent search is available once your organization has been verified"
      );
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
router.use(requireActiveEmployer);

const levelEnum = z.enum(["beginner", "intermediate", "advanced"]);

const searchQuerySchema = z.object({
  // "skillId:level,skillId:level" (level defaults to beginner)
  skills: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(200).optional(),
  search: z.string().trim().max(200).optional(),
  min_match: z.coerce.number().int().min(0).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const uuid = z.string().uuid();

export function parseRequirements(raw) {
  if (!raw) return [];
  const seen = new Set();
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [skillId, level = "beginner"] = part.split(":");
      const parsedId = uuid.safeParse(skillId);
      const parsedLevel = levelEnum.safeParse(level);
      if (!parsedId.success || !parsedLevel.success) {
        throw new ApiError(422, "Invalid skills filter", [
          { path: "skills", message: `Unrecognised requirement "${part}"` },
        ]);
      }
      return { skill_id: parsedId.data, level: parsedLevel.data };
    })
    .filter((req) => {
      if (seen.has(req.skill_id)) return false;
      seen.add(req.skill_id);
      return true;
    });
}

export function scoreCandidate(candidateSkills, requirements) {
  const bySkill = new Map(candidateSkills.map((row) => [row.skill_id, row]));
  const matched = [];
  const gaps = [];
  for (const req of requirements) {
    const row = bySkill.get(req.skill_id);
    const verified =
      row?.verification_status === "verified" &&
      LEVEL_RANK[row.verified_level] >= LEVEL_RANK[req.level];
    if (verified) matched.push(req);
    else gaps.push({ ...req, status: row ? "claimed" : "missing" });
  }
  const percent = requirements.length
    ? Math.round((matched.length / requirements.length) * 100)
    : null;
  return { matched, gaps, percent };
}

router.get(
  "/",
  validate({ query: searchQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.validatedQuery, {
      defaultLimit: 12,
      maxLimit: 50,
    });
    const { location, search, min_match: minMatch = 0 } = req.validatedQuery;
    const requirements = parseRequirements(req.validatedQuery.skills);

    const skillCatalog = requirements.length
      ? await prisma.skill.findMany({
          where: { id: { in: requirements.map((r) => r.skill_id) } },
          select: { id: true, name: true },
        })
      : [];
    const skillName = new Map(skillCatalog.map((s) => [s.id, s.name]));

    const profiles = await prisma.candidateProfile.findMany({
      where: {
        open_to_work: true,
        profile_visibility: { in: ["public", "employers_only"] },
        user: { status: "active" },
        ...(location ? { location: { contains: location, mode: "insensitive" } } : {}),
        ...(search
          ? {
              OR: [
                { headline: { contains: search, mode: "insensitive" } },
                { user: { full_name: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
        ...(requirements.length
          ? { skills: { some: { skill_id: { in: requirements.map((r) => r.skill_id) } } } }
          : {}),
      },
      include: {
        user: { select: { full_name: true, avatar_url: true } },
        skills: { include: { skill: { select: { id: true, name: true } } } },
      },
      take: 500,
    });

    const ranked = profiles
      .map((profile) => {
        const { matched, gaps, percent } = scoreCandidate(profile.skills, requirements);
        const verifiedSkills = profile.skills.filter((s) => s.verification_status === "verified");
        return {
          candidate_profile_id: profile.id,
          full_name: profile.user.full_name,
          avatar_url: profile.user.avatar_url,
          headline: profile.headline,
          location: profile.location,
          match_percent: percent,
          matched_skills: matched.map((m) => ({
            skill_id: m.skill_id,
            name: skillName.get(m.skill_id) ?? "Skill",
            required_level: m.level,
          })),
          gaps: gaps.map((g) => ({
            skill_id: g.skill_id,
            name: skillName.get(g.skill_id) ?? "Skill",
            required_level: g.level,
            status: g.status,
          })),
          verified_skill_count: verifiedSkills.length,
          skills: profile.skills
            .map((row) => ({
              skill_id: row.skill_id,
              name: row.skill.name,
              declared_level: row.declared_level,
              verification_status: row.verification_status,
              verified_level: row.verified_level,
            }))
            .sort((a, b) => (b.verified_level ? 1 : 0) - (a.verified_level ? 1 : 0)),
        };
      })
      // With a requirement list, only verified matches count: someone who just
      // claims the skills is not a match.
      .filter((row) => (requirements.length ? (row.match_percent ?? 0) > 0 : true))
      .filter((row) => (row.match_percent ?? 100) >= minMatch)
      .sort(
        (a, b) =>
          (b.match_percent ?? 0) - (a.match_percent ?? 0) ||
          b.verified_skill_count - a.verified_skill_count ||
          a.full_name.localeCompare(b.full_name)
      );

    const items = ranked.slice(skip, skip + limit);
    return sendSuccess(res, {
      data: {
        ...paginatedData(items, ranked.length, page, limit),
        requirements: requirements.map((r) => ({
          ...r,
          name: skillName.get(r.skill_id) ?? "Skill",
        })),
      },
    });
  })
);

router.get(
  "/:candidateProfileId",
  validate({ params: idParam("candidateProfileId") }),
  asyncHandler(async (req, res) => {
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: req.params.candidateProfileId },
      include: {
        user: { select: { full_name: true, avatar_url: true } },
        educations: { orderBy: { start_year: "desc" } },
        experiences: { orderBy: { start_date: "desc" } },
        projects: { orderBy: { created_at: "desc" } },
        certifications: { orderBy: { created_at: "desc" } },
        skills: { include: { skill: true } },
      },
    });
    if (!profile || profile.profile_visibility === "private") {
      throw new ApiError(404, "Candidate profile not found");
    }

    // Evidence behind the verified badges: finished, graded attempts.
    const attempts = await prisma.assessmentAttempt.findMany({
      where: {
        candidate_profile_id: profile.id,
        result_status: { in: ["passed", "failed"] },
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            assessment_type: true,
            skills: { include: { skill: { select: { name: true } } } },
          },
        },
      },
      orderBy: { evaluated_at: "desc" },
      take: 20,
    });

    return sendSuccess(res, {
      data: {
        profile,
        assessment_evidence: attempts.map((attempt) => ({
          attempt_id: attempt.id,
          assessment_title: attempt.assessment.title,
          skills: attempt.assessment.skills.map((s) => s.skill.name),
          result_status: attempt.result_status,
          score: attempt.score,
          level: attempt.level,
          question_count: attempt.question_count,
          correct_count: attempt.correct_count,
          focus_losses: attempt.focus_losses,
          evaluated_at: attempt.evaluated_at,
        })),
      },
    });
  })
);

export default router;

import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../errors/apiError.js";

export async function getProfileForUser(userId) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) {
    throw new ApiError(403, "This account does not have a candidate profile");
  }
  return profile;
}

export async function getPublicProfile(profileId, viewer) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: profileId },
    include: {
      user: { select: { full_name: true, avatar_url: true } },
      educations: { orderBy: { start_year: "desc" } },
      experiences: { orderBy: { start_date: "desc" } },
      projects: { orderBy: { created_at: "desc" } },
      certifications: { orderBy: { created_at: "desc" } },
      skills: { include: { skill: true } },
    },
  });

  if (!profile) throw new ApiError(404, "Candidate profile not found");

  const isOwner = viewer?.user.id === profile.user_id;
  const isAdmin = viewer?.user.role === "admin";
  const isEmployer = viewer?.user.role === "employer";

  if (!isOwner && !isAdmin) {
    if (profile.profile_visibility === "private") {
      throw new ApiError(404, "Candidate profile not found");
    }
    if (profile.profile_visibility === "employers_only" && !isEmployer) {
      throw new ApiError(404, "Candidate profile not found");
    }
  }

  return profile;
}

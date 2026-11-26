// Links an institution's students to their TalentGrid candidate accounts so the
// institute can see how job-ready the cohort is.
//
// A student is "linked" when their membership has a user_id (set when the
// student verifies the membership). Only skills verified through graded
// assessments count; claimed skills never do.

export const JOB_READY_MIN_SKILLS = 2;

// Map<user_id, { profile_id, verified: [{ name, level }] }>
export async function verifiedSkillsByUser(prisma, userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const profiles = await prisma.candidateProfile.findMany({
    where: { user_id: { in: ids } },
    select: {
      id: true,
      user_id: true,
      skills: {
        where: { verification_status: "verified" },
        select: { verified_level: true, skill: { select: { name: true } } },
      },
    },
  });

  return new Map(
    profiles.map((profile) => [
      profile.user_id,
      {
        profile_id: profile.id,
        verified: profile.skills
          .map((row) => ({ name: row.skill.name, level: row.verified_level }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
    ])
  );
}

export function skillsView(entry) {
  return {
    profile_id: entry?.profile_id ?? null,
    verified_count: entry?.verified.length ?? 0,
    verified: entry?.verified ?? [],
  };
}

// Cohort summary across every active student of the institution.
export async function cohortSummary(prisma, institutionId) {
  const memberships = await prisma.institutionMembership.findMany({
    where: { institution_id: institutionId, membership_status: "active" },
    select: { user_id: true },
  });
  const byUser = await verifiedSkillsByUser(
    prisma,
    memberships.map((m) => m.user_id)
  );

  let linked = 0;
  let withVerified = 0;
  let jobReady = 0;
  const skillCounts = new Map();

  for (const membership of memberships) {
    const entry = membership.user_id ? byUser.get(membership.user_id) : null;
    if (!entry) continue;
    linked += 1;
    if (entry.verified.length >= 1) withVerified += 1;
    if (entry.verified.length >= JOB_READY_MIN_SKILLS) jobReady += 1;
    for (const skill of entry.verified) {
      skillCounts.set(skill.name, (skillCounts.get(skill.name) ?? 0) + 1);
    }
  }

  return {
    students: memberships.length,
    linked,
    with_verified: withVerified,
    job_ready: jobReady,
    top_skills: [...skillCounts.entries()]
      .map(([name, verified_students]) => ({ name, verified_students }))
      .sort((a, b) => b.verified_students - a.verified_students || a.name.localeCompare(b.name))
      .slice(0, 6),
  };
}

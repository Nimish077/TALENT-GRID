// Placement-drive eligibility.
//
// A candidate is eligible when they hold a verified, active membership of the
// drive's institution AND satisfy every configured criterion. Missing data on
// a member (null cgpa/backlogs) fails a configured cutoff rather than passing
// silently.

export function checkDriveEligibility(drive, membership, departments = []) {
  if (!membership) {
    return { eligible: false, reasons: ["no_membership"] };
  }

  const reasons = [];

  if (membership.verification_status !== "verified") {
    reasons.push("membership_not_verified");
  }
  if (membership.membership_status !== "active") {
    reasons.push("membership_not_active");
  }

  if (drive.min_cgpa !== null && drive.min_cgpa !== undefined) {
    if (membership.cgpa === null || membership.cgpa === undefined) {
      reasons.push("cgpa_missing");
    } else if (Number(membership.cgpa) < Number(drive.min_cgpa)) {
      reasons.push("cgpa_below_minimum");
    }
  }

  if (drive.max_backlogs !== null && drive.max_backlogs !== undefined) {
    if (
      membership.backlog_count === null ||
      membership.backlog_count === undefined
    ) {
      reasons.push("backlogs_unknown");
    } else if (membership.backlog_count > drive.max_backlogs) {
      reasons.push("too_many_backlogs");
    }
  }

  if (drive.eligible_batch && membership.batch !== drive.eligible_batch) {
    reasons.push("batch_not_eligible");
  }

  if (departments.length > 0) {
    const normalized = departments.map((department) =>
      department.department_name.toLowerCase()
    );
    const match =
      membership.department &&
      normalized.includes(membership.department.toLowerCase());
    if (!match) reasons.push("department_not_eligible");
  }

  return { eligible: reasons.length === 0, reasons };
}

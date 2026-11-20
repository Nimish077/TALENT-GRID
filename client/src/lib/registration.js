// The API requires a unique institution `code`; the design only asks for a
// name, so derive one (e.g. "BITS Pilani" -> "BITS-PILANI-4F2K").
export function deriveInstitutionCode(name) {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug || "INST"}-${suffix}`;
}

export function buildRegistrationPayload(role, { fullName, orgName, email, password }) {
  const base = { role, full_name: fullName.trim(), email: email.trim(), password };
  if (role === "employer") return { ...base, organization: { name: orgName.trim() } };
  if (role === "institute") {
    return { ...base, institution: { name: orgName.trim(), code: deriveInstitutionCode(orgName) } };
  }
  return base;
}

// Whether the login pages should offer the one-click demo accounts.
//
//   DEMO_LOGIN=true   always on
//   DEMO_LOGIN=false  always off (even when the demo data is seeded)
//   (unset)           follows SEED_DEMO: a server that seeds the demo accounts
//                     on start-up shows them, one that does not, does not
//
// Anything other than the exact string "true" counts as off.
export function resolveDemoLogin(source) {
  const explicit = source.DEMO_LOGIN?.trim();
  if (explicit !== undefined && explicit !== "") return explicit === "true";
  return source.SEED_DEMO?.trim() === "true";
}

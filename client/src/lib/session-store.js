let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user ?? null;
}

export function clearCurrentUser() {
  currentUser = null;
}

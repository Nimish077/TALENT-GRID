let csrfToken = null;

export function getCsrfToken() {
  return csrfToken;
}

export function setCsrfToken(token) {
  csrfToken = typeof token === "string" && token.length > 0 ? token : null;
}

export function clearCsrfToken() {
  csrfToken = null;
}

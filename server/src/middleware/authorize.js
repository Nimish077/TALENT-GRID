import { ApiError } from "../errors/apiError.js";

// Role gate for platform-level roles: requireRole("admin", "employer").
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) throw new ApiError(401, "Authentication required");
    if (roles.length > 0 && !roles.includes(req.auth.user.role)) {
      throw new ApiError(
        403,
        "You do not have permission to perform this action"
      );
    }
    next();
  };
}

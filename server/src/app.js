import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { ApiError } from "./errors/apiError.js";
import { cookieParser } from "./middleware/cookies.js";
import { csrfProtection } from "./middleware/csrf.js";
import { apiLimiter } from "./middleware/rateLimits.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import candidatesRoutes from "./modules/candidates/candidates.routes.js";
import skillsRoutes from "./modules/skills/skills.routes.js";
import organizationsRoutes from "./modules/organizations/organizations.routes.js";
import jobsRoutes from "./modules/jobs/jobs.routes.js";
import applicationsRoutes from "./modules/jobs/applications.routes.js";
import assessmentsRoutes from "./modules/assessments/assessments.routes.js";
import institutionsRoutes from "./modules/institutions/institutions.routes.js";
import claimsRoutes from "./modules/institutions/claims.routes.js";
import drivesRoutes from "./modules/drives/drives.routes.js";
import institutionDrivesRoutes from "./modules/drives/institution-drives.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", env.trustProxy);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin))
          return callback(null, true);
        return callback(new ApiError(403, "Request origin is not allowed"));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser);
  app.use(csrfProtection);
  app.use(apiLimiter);

  app.get("/health", (req, res) => {
    res.json({ success: true, message: "OK", data: { status: "healthy" } });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/candidates", candidatesRoutes);
  app.use("/api/v1/skills", skillsRoutes);
  app.use("/api/v1/organizations", organizationsRoutes);
  app.use("/api/v1/jobs", jobsRoutes);
  app.use("/api/v1/applications", applicationsRoutes);
  app.use("/api/v1/assessments", assessmentsRoutes);
  app.use("/api/v1/institutions", institutionsRoutes);
  app.use("/api/v1/institutions", institutionDrivesRoutes);
  app.use("/api/v1/membership-claims", claimsRoutes);
  app.use("/api/v1/drives", drivesRoutes);
  app.use("/api/v1/admin", adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

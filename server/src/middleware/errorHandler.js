import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { ApiError } from "../errors/apiError.js";

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    error: [],
  });
}

export function errorHandler(error, req, res, next) {
  const respond = (statusCode, message, details = []) =>
    res.status(statusCode).json({ success: false, message, error: details });

  if (error instanceof ApiError) {
    return respond(error.statusCode, error.message, error.error ?? []);
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return respond(422, "Validation failed", details);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return respond(409, "A record with this value already exists", [
        {
          path: (error.meta?.target ?? []).join?.(".") ?? "",
          message: "duplicate value",
        },
      ]);
    }
    if (error.code === "P2003") {
      return respond(409, "Operation conflicts with a related record");
    }
    if (error.code === "P2025") {
      return respond(404, "Record not found");
    }
  }

  if (error.type === "entity.parse.failed") {
    return respond(400, "Request body is not valid JSON");
  }

  console.error("[error]", error);
  return respond(
    500,
    env.isProduction ? "Internal server error" : error.message
  );
}

// Rate limiters. Disabled under NODE_ENV=test so suites can exercise the
// endpoints; enabled everywhere else.

import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const skip = () => env.isTest;

function jsonHandler(req, res) {
  res
    .status(429)
    .json({ success: false, message: "Too many requests", error: [] });
}

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler: jsonHandler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler: jsonHandler,
});

export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler: jsonHandler,
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  handler: jsonHandler,
});

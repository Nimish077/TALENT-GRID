// Mailer boundary.
//
// MAILER=console  dev-only OTP sink (rejected at startup in production).
// MAILER=test     in-memory outbox used exclusively by the test suite.
// MAILER=smtp     reserved; not implemented yet — sends fail with 503 so OTP
//                 endpoints degrade safely instead of pretending to deliver.

import { env } from "../config/env.js";
import { ApiError } from "../errors/apiError.js";

export const testOutbox = [];

function consoleMailer() {
  return {
    name: "console",
    async send({ to, subject, text }) {
      console.info(`[mailer:console] to=${to} subject="${subject}"\n${text}`);
    },
  };
}

function testMailer() {
  return {
    name: "test",
    async send(message) {
      testOutbox.push({ ...message, sent_at: new Date() });
    },
  };
}

function smtpMailer() {
  return {
    name: "smtp",
    async send() {
      throw new ApiError(
        503,
        "SMTP mailer is not configured; OTP delivery is unavailable on this deployment"
      );
    },
  };
}

function createMailer() {
  switch (env.mailer) {
    case "console":
      return consoleMailer();
    case "test":
      return testMailer();
    case "smtp":
      return smtpMailer();
    default:
      throw new Error(`Unknown mailer "${env.mailer}"`);
  }
}

export const mailer = createMailer();

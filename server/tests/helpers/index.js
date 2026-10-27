import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { testOutbox } from "../../src/services/mailer.js";

export const app = createApp();
export { prisma, testOutbox };

export const ORIGIN = "http://localhost:3000";

export async function resetDb() {
  const tables = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  );
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((table) => `"${table.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`
  );
}

let counter = 0;
export function uniqueEmail(prefix = "user") {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@example.com`;
}

export function cookieHeaderFrom(res) {
  const raw = res.headers["set-cookie"] ?? [];
  return raw.map((cookie) => cookie.split(";")[0]).join("; ");
}

export function cookieValue(res, name) {
  const raw = res.headers["set-cookie"] ?? [];
  const match = raw.find((cookie) => cookie.startsWith(`${name}=`));
  return match
    ? decodeURIComponent(match.split(";")[0].slice(name.length + 1))
    : undefined;
}

export async function registerUser({
  role = "candidate",
  email = uniqueEmail(role),
  password = "Password123!",
  extra = {},
} = {}) {
  const payload = { email, password, full_name: "Test User", role, ...extra };
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send(payload)
    .set("Origin", ORIGIN);
  if (res.status !== 201) {
    throw new Error(
      `register failed: ${res.status} ${JSON.stringify(res.body)}`
    );
  }
  return {
    res,
    email,
    password,
    user: res.body.data.user,
    accessToken: res.body.data.tokens.access_token,
    cookies: cookieHeaderFrom(res),
    csrf: cookieValue(res, "csrf_token"),
    refresh: cookieValue(res, "refresh_token"),
  };
}

export async function login(email, password) {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
    .set("Origin", ORIGIN);
  return {
    res,
    accessToken: res.body.data?.tokens?.access_token,
    cookies: cookieHeaderFrom(res),
    csrf: cookieValue(res, "csrf_token"),
    refresh: cookieValue(res, "refresh_token"),
  };
}

export async function makeAdmin({
  email = uniqueEmail("admin"),
  password = "Password123!",
} = {}) {
  const password_hash = await bcrypt.hash(password, 4);
  const user = await prisma.user.create({
    data: {
      email,
      password_hash,
      full_name: "Platform Admin",
      role: "admin",
      status: "active",
    },
  });
  const session = await login(email, password);
  return { user, email, password, ...session };
}

export function bearer(req, accessToken) {
  return req.set("Authorization", `Bearer ${accessToken}`);
}

export function lastOtpFor(email) {
  const messages = testOutbox.filter((message) => message.to === email);
  if (messages.length === 0) throw new Error(`No mail sent to ${email}`);
  const match = messages[messages.length - 1].text.match(/\b(\d{6})\b/);
  if (!match) throw new Error("No OTP found in the last message");
  return match[1];
}

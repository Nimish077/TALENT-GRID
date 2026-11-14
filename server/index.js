import { env } from "./src/config/env.js";
import { createApp } from "./src/app.js";
import { prisma } from "./src/lib/prisma.js";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(
    `TalentGrid API listening on http://localhost:${env.port} (${env.nodeEnv})`
  );
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

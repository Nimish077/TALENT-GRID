// Public, non-secret settings the client needs before anyone is signed in.
//
//   GET /api/v1/config  ->  { demo_login: boolean }
//
// demo_login tells the login pages whether to show the one-click demo accounts.
// It is a runtime switch (see config/demo.js), so turning it on or off needs a
// server restart but no rebuild of the client.

import { Router } from "express";
import { env } from "../../config/env.js";
import { sendSuccess } from "../../utils/response.js";

const router = Router();

router.get("/", (req, res) => {
  res.set("Cache-Control", "no-store");
  return sendSuccess(res, { data: { demo_login: env.demoLogin } });
});

export default router;

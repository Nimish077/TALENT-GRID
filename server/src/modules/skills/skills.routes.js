import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/authorize.js";
import { parsePagination, paginatedData } from "../../utils/pagination.js";
import { idParam } from "../candidates/candidates.schemas.js";

const router = Router();

router.use(authenticate);

const listQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  status: z.enum(["active", "archived"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const skillCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(120).nullish(),
  description: z.string().trim().max(2000).nullish(),
});

const skillUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().max(120).nullish(),
  description: z.string().trim().max(2000).nullish(),
  status: z.enum(["active", "archived"]).optional(),
});

router.get(
  "/",
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, skip, take } = parsePagination(req.validatedQuery);
    const { search, category } = req.validatedQuery;
    const status = req.validatedQuery.status ?? "active";

    const where = {
      status,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(category
        ? { category: { equals: category, mode: "insensitive" } }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.skill.findMany({ where, orderBy: { name: "asc" }, skip, take }),
      prisma.skill.count({ where }),
    ]);
    return sendSuccess(res, { data: paginatedData(items, total, page, limit) });
  })
);

router.post(
  "/",
  requireRole("admin"),
  validate({ body: skillCreateSchema }),
  asyncHandler(async (req, res) => {
    const skill = await prisma.skill.create({ data: req.body });
    return sendSuccess(res, {
      statusCode: 201,
      message: "Skill created",
      data: { skill },
    });
  })
);

router.patch(
  "/:skillId",
  requireRole("admin"),
  validate({ params: idParam("skillId"), body: skillUpdateSchema }),
  asyncHandler(async (req, res) => {
    const skill = await prisma.skill.update({
      where: { id: req.params.skillId },
      data: req.body,
    });
    return sendSuccess(res, { message: "Skill updated", data: { skill } });
  })
);

export default router;

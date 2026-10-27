// Drive creation/listing lives under the institution resource:
//   POST /api/v1/institutions/:institutionId/drives
//   GET  /api/v1/institutions/:institutionId/drives

import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/response.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireInstitutionAccess } from "../../middleware/tenant.js";
import { driveCreateSchema } from "./drives.schemas.js";

const router = Router();

router.use(authenticate);

router.post(
  "/:institutionId/drives",
  requireInstitutionAccess({ roles: ["owner", "admin"] }),
  validate({ body: driveCreateSchema }),
  asyncHandler(async (req, res) => {
    const { departments, ...data } = req.body;
    const uniqueDepartments = departments
      ? [...new Set(departments.map((department) => department.trim()))]
      : [];

    const drive = await prisma.$transaction(async (tx) => {
      const created = await tx.placementDrive.create({
        data: {
          ...data,
          institution_id: req.institution.id,
          created_by_user_id: req.auth.user.id,
        },
      });
      if (uniqueDepartments.length > 0) {
        await tx.placementDriveDepartment.createMany({
          data: uniqueDepartments.map((department_name) => ({
            placement_drive_id: created.id,
            department_name,
          })),
        });
      }
      return tx.placementDrive.findUnique({
        where: { id: created.id },
        include: { departments: true },
      });
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Drive created",
      data: { drive },
    });
  })
);

router.get(
  "/:institutionId/drives",
  requireInstitutionAccess(),
  asyncHandler(async (req, res) => {
    const drives = await prisma.placementDrive.findMany({
      where: { institution_id: req.institution.id },
      include: { _count: { select: { candidates: true } } },
      orderBy: { created_at: "desc" },
    });
    return sendSuccess(res, { data: { drives } });
  })
);

export default router;

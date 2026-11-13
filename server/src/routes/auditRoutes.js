
import { Router } from "express";
import AuditLog from "../models/AuditLog.js";

import {
  authenticate,
  allowRoles,
} from "../middleware/auth.js";

const router = Router();

// Only Admin can view audit history.
router.use(authenticate, allowRoles("admin"));

const allowedActions = [
  "order_item.prepared",
  "purchase.received",
  "inventory.waste_recorded",
  "inventory.count_recorded",
  "user.created",
  "user.role_changed",
  "user.deactivated",
  "user.reactivated",
  "order.created",
  "purchase_order.created",
  "auth.password_changed",
];

router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const actorId = req.query.actor_id;
    const action = req.query.action;

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 500
    ) {
      return res.status(400).json({
        message: "Invalid page number",
      });
    }

    const where = {};

    if (actorId !== undefined && actorId !== "") {
      const id = Number(actorId);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          message: "Invalid employee ID",
        });
      }

      where.actor_user_id = id;
    }

    if (action) {
      if (
        typeof action !== "string" ||
        !allowedActions.includes(action)
      ) {
        return res.status(400).json({
          message: "Invalid audit action",
        });
      }

      where.action = action;
    }

    const pageSize = 20;

    const result = await AuditLog.findAndCountAll({
      where,
      attributes: [
        "id",
        "actor_user_id",
        "actor_name",
        "actor_role",
        "action",
        "entity_type",
        "entity_id",
        "details",
        "created_at",
      ],
      order: [["id", "DESC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return res.json({
      rows: result.rows,
      total: result.count,
      page,
      page_size: pageSize,
    });
  } catch (error) {
    console.error("Audit report error:", error);

    return res.status(500).json({
      message: "Failed to load audit history",
    });
  }
});

export default router;

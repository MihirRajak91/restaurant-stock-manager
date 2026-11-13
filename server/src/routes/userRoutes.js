
import { Router } from "express";
import argon2 from "argon2";
import { UniqueConstraintError } from "sequelize";

import sequelize from "../db.js";
import User from "../models/User.js";

import {
  authenticate,
  allowRoles,
} from "../middleware/auth.js";

import {
  changeUserAccess,
  lockCurrentAdmin,
  UserManagementError,
} from "../services/manageUser.js";

import { writeAudit } from "../services/auditService.js";

const router = Router();

// All routes in this file require Admin access.
router.use(authenticate, allowRoles("admin"));

const userFields = [
  "id", "name", "email", "role",
  "is_active", "created_at",
];

function handleError(res, error) {
  if (error instanceof UserManagementError) {
    return res.status(error.status).json({
      message: error.message,
    });
  }

  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({
      message: "Employee email already exists",
    });
  }

  console.error("User management error:", error);

  return res.status(500).json({
    message: "User management request failed",
  });
}

// GET /api/users
router.get("/", async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: userFields,
      order: [["name", "ASC"]],
    });

    return res.json(users);
  } catch (error) {
    return handleError(res, error);
  }
});

// POST /api/users
router.post("/", async (req, res) => {
  const { name, email, password, role } = req.body ?? {};

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 100 ||
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128 ||
    !["admin", "manager", "kitchen"].includes(role)
  ) {
    return res.status(400).json({
      message: "Enter valid employee details",
    });
  }

  try {
    // Hash before opening the database transaction.
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const result = await sequelize.transaction(
      async (transaction) => {
        const actor = await lockCurrentAdmin(
          transaction,
          req.user.id
        );

        const user = await User.create(
          {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password_hash: passwordHash,
            role,
          },
          { transaction }
        );

        await writeAudit({
          transaction,
          actor,
          action: "user.created",
          entityType: "user",
          entityId: user.id,
          details: {
            assigned_role: user.role,
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
        };
      }
    );

    return res.status(201).json({ user: result });
  } catch (error) {
    return handleError(res, error);
  }
});

// PATCH /api/users/:id/role
router.patch("/:id/role", async (req, res) => {
  try {
    const result = await changeUserAccess({
      actorId: req.user.id,
      targetId: Number(req.params.id),
      operation: "role",
      value: req.body?.role,
    });

    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
});

// PATCH /api/users/:id/status
router.patch("/:id/status", async (req, res) => {
  try {
    const result = await changeUserAccess({
      actorId: req.user.id,
      targetId: Number(req.params.id),
      operation: "status",
      value: req.body?.is_active,
    });

    return res.json(result);
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;

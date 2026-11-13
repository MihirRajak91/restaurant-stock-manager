
import { Router } from "express";
import argon2 from "argon2";
import { rateLimit } from "express-rate-limit";
import { UniqueConstraintError } from "sequelize";

import User from "../models/User.js";
import { authenticate, allowRoles } from "../middleware/auth.js";

import {
  COOKIE_NAME,
  cookieOptions,
  clearCookieOptions,
  createSessionToken,
  publicUser,
} from "../utils/session.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Try again later.",
  },
});

const validEmail = (email) =>
  typeof email === "string" &&
  email.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validPassword = (password) =>
  typeof password === "string" &&
  password.length >= 12 &&
  password.length <= 128;

// Login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      where: {
        email: email.trim().toLowerCase(),
      },
    });

    const passwordMatches = user
      ? await argon2.verify(user.password_hash, password)
      : false;

    if (!user || !passwordMatches || !user.is_active) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = createSessionToken(user);

    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.set("Cache-Control", "no-store");

    return res.json({
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login failed:", error);

    return res.status(500).json({
      message: "Unable to log in",
    });
  }
});

// Current logged-in employee
router.get("/me", authenticate, (req, res) => {
  res.set("Cache-Control", "no-store");

  return res.json({
    user: publicUser(req.user),
  });
});

// Logout: invalidate all sessions for this account
router.post("/logout", authenticate, async (req, res) => {
  try {
    await req.user.increment("session_version");

    res.clearCookie(COOKIE_NAME, clearCookieOptions);

    return res.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to log out",
    });
  }
});

// Password change
router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body ?? {};

    if (!validPassword(new_password)) {
      return res.status(400).json({
        message: "New password must contain 12–128 characters",
      });
    }

    if (
      typeof current_password !== "string" ||
      !(await argon2.verify(
        req.user.password_hash,
        current_password
      ))
    ) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    const passwordHash = await argon2.hash(new_password, {
      type: argon2.argon2id,
    });

    await req.user.update({
      password_hash: passwordHash,
      session_version: req.user.session_version + 1,
    });

    res.clearCookie(COOKIE_NAME, clearCookieOptions);

    return res.json({
      message: "Password updated. Please log in again.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to change password",
    });
  }
});

// Admin: list employees
router.get(
  "/users",
  authenticate,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const users = await User.findAll({
        attributes: [
          "id",
          "name",
          "email",
          "role",
          "is_active",
          "created_at",
        ],
        order: [["name", "ASC"]],
      });

      return res.json(users);
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        message: "Failed to load employees",
      });
    }
  }
);

// Admin: create an employee
router.post(
  "/users",
  authenticate,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body ?? {};

      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100 ||
        !validEmail(email) ||
        !validPassword(password) ||
        !["admin", "manager", "kitchen"].includes(role)
      ) {
        return res.status(400).json({
          message: "Enter valid employee details",
        });
      }

      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
      });

      const user = await User.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        role,
      });

      return res.status(201).json({
        user: publicUser(user),
      });

    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return res.status(409).json({
          message: "An employee with this email already exists",
        });
      }

      console.error(error);

      return res.status(500).json({
        message: "Failed to create employee",
      });
    }
  }
);

export default router;

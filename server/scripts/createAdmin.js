
import "dotenv/config";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";

import sequelize from "../src/db.js";
import User from "../src/models/User.js";

async function createAdmin() {
  try {
    await sequelize.authenticate();

    const existingAdmin = await User.findOne({
      where: {
        role: "admin",
        is_active: true,
      },
    });

    if (existingAdmin) {
      console.log("An active Admin already exists.");
      return;
    }

    // Generate a random initial password.
    const password = randomBytes(24).toString("base64url");

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const email = "admin@restaurant.local";

    const user = await User.create({
      name: "Restaurant Administrator",
      email,
      password_hash: passwordHash,
      role: "admin",
    });

    console.log("Admin account created");
    console.log("User ID:", user.id);
    console.log("Email:", email);
    console.log("Initial password:", password);
    console.log("Save this password securely.");
  } catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

createAdmin();

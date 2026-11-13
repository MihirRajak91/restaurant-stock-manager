
import sequelize from "../db.js";
import User from "../models/User.js";

import { writeAudit } from "./auditService.js";

export class UserManagementError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Serialize Admin management changes and recheck
// that the person performing them is still an Admin.
export async function lockCurrentAdmin(transaction, actorId) {
  await sequelize.query(
    "SELECT pg_advisory_xact_lock(13132026)",
    { transaction }
  );

  const actor = await User.findByPk(actorId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!actor || !actor.is_active || actor.role !== "admin") {
    throw new UserManagementError(
      403,
      "Active Admin access required"
    );
  }

  return actor;
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
  };
}

export async function changeUserAccess({
  actorId,
  targetId,
  operation,
  value,
}) {
  if (
    !Number.isSafeInteger(targetId) ||
    targetId <= 0
  ) {
    throw new UserManagementError(400, "Invalid employee ID");
  }

  if (
    operation === "role" &&
    !["admin", "manager", "kitchen"].includes(value)
  ) {
    throw new UserManagementError(400, "Invalid role");
  }

  if (
    operation === "status" &&
    typeof value !== "boolean"
  ) {
    throw new UserManagementError(400, "Invalid status");
  }

  if (!["role", "status"].includes(operation)) {
    throw new UserManagementError(400, "Invalid operation");
  }

  return sequelize.transaction(async (transaction) => {

    // 1. Lock and verify the Admin performing the action.
    const actor = await lockCurrentAdmin(
      transaction,
      actorId
    );

    // 2. Lock the employee whose account is changing.
    const target = await User.findByPk(targetId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!target) {
      throw new UserManagementError(
        404,
        "Employee not found"
      );
    }

    // 3. Do not allow Admin self-demotion/deactivation.
    if (String(actor.id) === String(target.id)) {
      throw new UserManagementError(
        409,
        "You cannot change your own role or status"
      );
    }

    const previousRole = target.role;
    const previousActive = target.is_active;

    const newRole = operation === "role"
      ? value
      : previousRole;

    const newActive = operation === "status"
      ? value
      : previousActive;

    // 4. Nothing changed — no audit record necessary.
    if (
      newRole === previousRole &&
      newActive === previousActive
    ) {
      return {
        changed: false,
        user: toPublicUser(target),
      };
    }

    // 5. Protect the final active Admin.
    const removingActiveAdmin =
      previousRole === "admin" &&
      previousActive &&
      (newRole !== "admin" || !newActive);

    if (removingActiveAdmin) {
      const activeAdminCount = await User.count({
        where: {
          role: "admin",
          is_active: true,
        },
        transaction,
      });

      if (activeAdminCount <= 1) {
        throw new UserManagementError(
          409,
          "At least one active Admin must remain"
        );
      }
    }

    // 6. Apply the change and invalidate old sessions.
    await target.update(
      {
        role: newRole,
        is_active: newActive,
        session_version: target.session_version + 1,
      },
      { transaction }
    );

    // 7. Decide the audit action.
    const action = operation === "role"
      ? "user.role_changed"
      : newActive
        ? "user.reactivated"
        : "user.deactivated";

    // 8. Record the Admin action.
    await writeAudit({
      transaction,
      actor,
      action,
      entityType: "user",
      entityId: target.id,
      details: {
        previous_role: previousRole,
        new_role: newRole,
        previous_active: previousActive,
        new_active: newActive,
      },
    });

    return {
      changed: true,
      user: toPublicUser(target),
    };
  });
}

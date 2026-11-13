
import AuditLog from "../models/AuditLog.js";

export async function writeAudit({
  transaction,
  actor,
  action,
  entityType,
  entityId,
  details = {},
}) {
  if (!transaction) {
    throw new Error(
      "An audit log must use the business transaction"
    );
  }

  if (!actor?.id) {
    throw new Error("Authenticated actor required");
  }

  return AuditLog.create(
    {
      actor_user_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    },
    { transaction }
  );
}

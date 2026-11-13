
import Decimal from "decimal.js";
import { UniqueConstraintError } from "sequelize";

import sequelize from "../db.js";
import Ingredient from "../models/Ingredient.js";
import InventoryEvent from "../models/InventoryEvent.js";
import StockMovement from "../models/StockMovement.js";

// Errors that routes can return to the client.
export class InventoryError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const reasons = {
  waste: ["spillage", "expired", "damaged", "other"],
  count: ["routine_count", "full_count", "investigation"],
};

// Our database allows 3 decimal places.
const quantityPattern =
  /^(0|[1-9]\d{0,8})(\.\d{1,3})?$/;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function summarize(event, alreadyRecorded) {
  return {
    event_id: event.id,
    event_type: event.event_type,
    ingredient_id: event.ingredient_id,
    reason: event.reason,
    quantity_entered: event.entered_quantity,
    quantity_before: event.quantity_before,
    quantity_after: event.quantity_after,
    quantity_delta: event.quantity_delta,
    already_recorded: alreadyRecorded,
  };
}

export async function recordInventoryEvent(input) {
  const {
    ingredient_id,
    event_type,
    reason,
    quantity,
    note,
    idempotency_key,
    expected_quantity_on_hand,
  } = input;

  const ingredientId = Number(ingredient_id);

  // 1. Validate incoming data.
  if (
    !Number.isSafeInteger(ingredientId) ||
    ingredientId <= 0 ||
    !reasons[event_type]?.includes(reason) ||
    typeof quantity !== "string" ||
    !quantityPattern.test(quantity) ||
    (event_type === "waste" &&
      !new Decimal(quantity).greaterThan(0)) ||
    typeof idempotency_key !== "string" ||
    !uuidPattern.test(idempotency_key) ||
    (note != null &&
      (typeof note !== "string" || note.length > 500))
  ) {
    throw new InventoryError(400, "Invalid inventory event data");
  }

  // Physical counts must use a known starting balance.
  if (
    event_type === "count" &&
    (
      typeof expected_quantity_on_hand !== "string" ||
      !quantityPattern.test(expected_quantity_on_hand)
    )
  ) {
    throw new InventoryError(
      400,
      "Expected stock quantity is required for stock counts"
    );
  }

  const normalizedNote = note?.trim() || null;

  try {
    return await sequelize.transaction(async (transaction) => {

      // 2. Lock the ingredient row.
      const ingredient = await Ingredient.findByPk(
        ingredientId,
        {
          transaction,
          lock: transaction.LOCK.UPDATE,
        }
      );

      if (!ingredient) {
        throw new InventoryError(404, "Ingredient not found");
      }

      // 3. Check for a previously completed request.
      const existing = await InventoryEvent.findOne({
        where: { idempotency_key },
        transaction,
      });

      if (existing) {
        const sameRequest =
          String(existing.ingredient_id) === String(ingredientId) &&
          existing.event_type === event_type &&
          existing.reason === reason &&
          new Decimal(existing.entered_quantity).eq(quantity) &&
          (existing.note ?? null) === normalizedNote;

        if (!sameRequest) {
          throw new InventoryError(
            409,
            "This request key was already used for another event"
          );
        }

        return summarize(existing, true);
      }

      if (!ingredient.is_active) {
        throw new InventoryError(
          409,
          "Archived ingredients cannot be adjusted"
        );
      }

      const before = new Decimal(
        ingredient.quantity_on_hand
      );

      const entered = new Decimal(quantity);
      if (ingredient.unit === "pcs" && !entered.isInteger()) {
        throw new InventoryError(
          400,
          "Piece-based ingredients require whole quantities"
        );
      }
      let after;

      if (event_type === "waste") {
        // Waste removes an amount from existing stock.
        if (entered.greaterThan(before)) {
          throw new InventoryError(
            409,
            `Insufficient ${ingredient.name}. ` +
            `Available: ${before.toString()} ${ingredient.unit}`
          );
        }

        after = before.minus(entered);
      } else {
        // A count sets stock to the physically counted amount.
        const expected = new Decimal(
          expected_quantity_on_hand
        );

        if (!before.eq(expected)) {
          throw new InventoryError(
            409,
            "Stock changed since the count started. " +
            "Refresh and verify the physical count."
          );
        }

        after = entered;
      }

      // 4. Calculate the change.
      const delta = after.minus(before);

      // 5. Record what happened.
      const event = await InventoryEvent.create(
        {
          ingredient_id: ingredient.id,
          event_type,
          reason,
          entered_quantity: entered.toFixed(3),
          quantity_before: before.toFixed(3),
          quantity_after: after.toFixed(3),
          quantity_delta: delta.toFixed(3),
          unit_cost: ingredient.cost_per_unit,
          note: normalizedNote,
          idempotency_key,
        },
        { transaction }
      );

      // 6. Update stock only if there is a difference.
      if (!delta.isZero()) {
        await ingredient.update(
          {
            quantity_on_hand: after.toFixed(3),
          },
          { transaction }
        );

        // 7. Record the same change in the ledger.
        await StockMovement.create(
          {
            ingredient_id: ingredient.id,
            inventory_event_id: event.id,
            movement_type:
              event_type === "waste"
                ? "waste"
                : "adjustment",
            quantity_delta: delta.toFixed(3),
            unit_cost: ingredient.cost_per_unit,
            note: `${event_type}: ${reason}`,
          },
          { transaction }
        );
      }

      return summarize(event, false);
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new InventoryError(
        409,
        "This inventory event key is already in use"
      );
    }

    throw error;
  }
}


import Decimal from "decimal.js";
import { UniqueConstraintError } from "sequelize";

import sequelize from "../db.js";
import Ingredient from "../models/Ingredient.js";
import PurchaseOrderItem from "../models/PurchaseOrderItem.js";
import PurchaseReceipt from "../models/PurchaseReceipt.js";
import StockMovement from "../models/StockMovement.js";

export class PurchaseError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const quantityPattern = /^(0|[1-9]\d{0,8})(\.\d{1,3})?$/;
const maxQuantity = new Decimal("999999999.999");

export async function receivePurchase({
  itemId,
  quantity,
  idempotencyKey,
}) {
  if (
    typeof quantity !== "string" ||
    !quantityPattern.test(quantity) ||
    !new Decimal(quantity).greaterThan(0)
  ) {
    throw new PurchaseError(400, "Invalid received quantity");
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    typeof idempotencyKey !== "string" ||
    !uuidPattern.test(idempotencyKey)
  ) {
    throw new PurchaseError(400, "Valid receipt key required");
  }

  try {
    return await sequelize.transaction(async (transaction) => {
      // 1. Lock the purchase order line.
      const line = await PurchaseOrderItem.findByPk(itemId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!line) {
        throw new PurchaseError(404, "Purchase line not found");
      }

      // 2. Check whether this delivery was already recorded.
      const existing = await PurchaseReceipt.findOne({
        where: { idempotency_key: idempotencyKey },
        transaction,
      });

      if (existing) {
        const sameLine =
          String(existing.purchase_order_item_id) === String(itemId);

        const sameQuantity =
          new Decimal(existing.quantity_received).eq(quantity);

        if (!sameLine || !sameQuantity) {
          throw new PurchaseError(
            409,
            "Receipt key was used for a different delivery"
          );
        }

        return {
          receipt_id: existing.id,
          already_received: true,
          quantity_received: existing.quantity_received,
          base_quantity: existing.base_quantity,
        };
      }

      // 3. Check the outstanding quantity.
      const remaining = new Decimal(line.quantity_ordered)
        .minus(line.quantity_received);

      const received = new Decimal(quantity);

      if (received.greaterThan(remaining)) {
        throw new PurchaseError(
          409,
          `Only ${remaining.toString()} ${line.purchase_unit} remains`
        );
      }

      // 4. Convert into the ingredient's inventory unit.
      const baseQuantity = received.times(
        line.conversion_factor
      );

      if (
        baseQuantity.decimalPlaces() > 3 ||
        baseQuantity.greaterThan(maxQuantity)
      ) {
        throw new PurchaseError(
          400,
          "Converted quantity exceeds supported precision or range"
        );
      }

      // 5. Lock the ingredient before updating its stock.
      const ingredient = await Ingredient.findByPk(
        line.ingredient_id,
        {
          transaction,
          lock: transaction.LOCK.UPDATE,
        }
      );

      if (!ingredient || !ingredient.is_active) {
        throw new PurchaseError(
          409,
          "Ingredient is missing or archived"
        );
      }

      const oldQuantity = new Decimal(
        ingredient.quantity_on_hand
      );

      const newQuantity = oldQuantity.plus(baseQuantity);

      if (newQuantity.greaterThan(maxQuantity)) {
        throw new PurchaseError(409, "Stock capacity exceeded");
      }

      // 6. Calculate purchase cost per inventory unit.
      const purchaseUnitCost = new Decimal(line.unit_price);

      const newStockValue = received.times(purchaseUnitCost);

      const costPerBaseUnit = purchaseUnitCost.dividedBy(
        line.conversion_factor
      );

      // 7. Calculate weighted-average inventory cost.
      const oldStockValue = oldQuantity.times(
        ingredient.cost_per_unit
      );

      const newAverageCost = oldStockValue
        .plus(newStockValue)
        .dividedBy(newQuantity);

      // 8. Save the receipt.
      const receipt = await PurchaseReceipt.create(
        {
          purchase_order_item_id: line.id,
          quantity_received: received.toFixed(3),
          base_quantity: baseQuantity.toFixed(3),
          unit_cost_per_base: costPerBaseUnit.toFixed(4),
          idempotency_key: idempotencyKey,
        },
        { transaction }
      );

      // 9. Update the quantity received on the PO line.
      const totalReceived = new Decimal(
        line.quantity_received
      ).plus(received);

      await line.update(
        {
          quantity_received: totalReceived.toFixed(3),
        },
        { transaction }
      );

      // 10. Update inventory.
      await ingredient.update(
        {
          quantity_on_hand: newQuantity.toFixed(3),
          cost_per_unit: newAverageCost.toFixed(4),
        },
        { transaction }
      );

      // 11. Record a positive stock movement.
      await StockMovement.create(
        {
          ingredient_id: ingredient.id,
          purchase_receipt_id: receipt.id,
          movement_type: "purchase",
          quantity_delta: baseQuantity.toFixed(3),
          unit_cost: costPerBaseUnit.toFixed(4),
          note: `Received purchase order item ${line.id}`,
        },
        { transaction }
      );

      return {
        receipt_id: receipt.id,
        already_received: false,
        ingredient: ingredient.name,
        quantity_received: received.toFixed(3),
        purchase_unit: line.purchase_unit,
        base_quantity: baseQuantity.toFixed(3),
        base_unit: ingredient.unit,
        new_stock: newQuantity.toFixed(3),
        new_average_cost: newAverageCost.toFixed(4),
        quantity_outstanding: new Decimal(
          line.quantity_ordered
        ).minus(totalReceived).toFixed(3),
      };
    });
  } catch (error) {
    // A unique key conflict from a different purchase line
    // is not a reason to record another receipt.
    if (error instanceof UniqueConstraintError) {
      throw new PurchaseError(
        409,
        "This receipt key has already been used"
      );
    }

    throw error;
  }
}

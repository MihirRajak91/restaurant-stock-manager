
import Decimal from "decimal.js";

import Ingredient from "../models/Ingredient.js";
import OrderItem from "../models/OrderItem.js";
import StockMovement from "../models/StockMovement.js";

export async function getDashboardData() {

  // 1. Get all active ingredients.
  const ingredients = await Ingredient.findAll({
    where: { is_active: true },
    attributes: [
      "id",
      "name",
      "unit",
      "quantity_on_hand",
      "reorder_level",
      "cost_per_unit",
    ],
    order: [["name", "ASC"]],
  });

  // 2. Count kitchen items still pending.
  const pendingOrderItems = await OrderItem.count({
    where: { status: "pending" },
  });

  // 3. Get the last 10 inventory movements.
  const movements = await StockMovement.findAll({
    attributes: [
      "id",
      "movement_type",
      "quantity_delta",
      "created_at",
    ],
    include: [{
      model: Ingredient,
      as: "ingredient",
      attributes: ["name", "unit"],
    }],
    order: [["id", "DESC"]],
    limit: 10,
  });

  // 4. Prepare dashboard calculations.
  const alerts = [];
  let inventoryValue = new Decimal(0);

  for (const ingredient of ingredients) {
    const quantity = new Decimal(
      ingredient.quantity_on_hand
    );

    const threshold = new Decimal(
      ingredient.reorder_level
    );

    const unitCost = new Decimal(
      ingredient.cost_per_unit
    );

    // Quantity multiplied by cost per unit.
    const stockValue = quantity.times(unitCost);

    inventoryValue = inventoryValue.plus(stockValue);

    // Decide whether this ingredient needs attention.
    let level = null;

    if (quantity.isZero()) {
      level = "out_of_stock";
    } else if (
      threshold.greaterThan(0) &&
      quantity.lessThanOrEqualTo(threshold)
    ) {
      level = "low_stock";
    }

    if (level) {
      const shortage = threshold.greaterThan(quantity)
        ? threshold.minus(quantity).toFixed(3)
        : null;

      alerts.push({
        ingredient_id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        quantity_on_hand: ingredient.quantity_on_hand,
        reorder_level: ingredient.reorder_level,
        level,
        shortage_to_threshold: shortage,
      });
    }
  }

  // Display out-of-stock alerts before low-stock alerts.
  alerts.sort((a, b) => {
    if (a.level === b.level) {
      return a.name.localeCompare(b.name);
    }

    return a.level === "out_of_stock" ? -1 : 1;
  });

  // 5. Return the dashboard response.
  return {
    summary: {
      active_ingredients: ingredients.length,
      low_stock_count: alerts.length,
      out_of_stock_count: alerts.filter(
        (alert) => alert.level === "out_of_stock"
      ).length,
      inventory_value: inventoryValue.toFixed(2),
      pending_order_items: pendingOrderItems,
    },

    alerts,

    recent_movements: movements.map((movement) => ({
      id: movement.id,
      ingredient_name: movement.ingredient.name,
      unit: movement.ingredient.unit,
      movement_type: movement.movement_type,
      quantity_delta: movement.quantity_delta,
      created_at: movement.created_at,
    })),

    generated_at: new Date().toISOString(),
  };
}

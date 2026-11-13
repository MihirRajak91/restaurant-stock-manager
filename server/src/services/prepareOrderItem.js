
import Decimal from "decimal.js";
import sequelize from "../db.js";

import OrderItem from "../models/OrderItem.js";
import Ingredient from "../models/Ingredient.js";
import RecipeIngredient from "../models/RecipeIngredient.js";
import StockMovement from "../models/StockMovement.js";

// Custom error with an HTTP status.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function prepareOrderItem(itemId) {
  return sequelize.transaction(async (transaction) => {

    // 1. Lock this order item first.
    const orderItem = await OrderItem.findByPk(itemId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!orderItem) {
      throw new HttpError(404, "Order item not found");
    }

    // Already prepared? Do not deduct again.
    if (orderItem.status === "prepared") {
      return {
        order_item_id: orderItem.id,
        status: "prepared",
        already_prepared: true,
      };
    }

    if (orderItem.status !== "pending") {
      throw new HttpError(
        409,
        "Only pending items can be prepared"
      );
    }

    // 2. Retrieve the recipe.
    const recipeRows = await RecipeIngredient.findAll({
      where: {
        menu_item_id: orderItem.menu_item_id,
      },
      order: [["ingredient_id", "ASC"]],
      transaction,
    });

    if (recipeRows.length === 0) {
      throw new HttpError(409, "Recipe has no ingredients");
    }

    // 3. Get ingredient IDs from the recipe.
    const ingredientIds = recipeRows.map(
      (row) => row.ingredient_id
    );

    // 4. Lock ingredient stock rows in ID order.
    const ingredients = await Ingredient.findAll({
      where: {
        id: ingredientIds,
      },
      order: [["id", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (ingredients.length !== recipeRows.length) {
      throw new HttpError(
        409,
        "One or more recipe ingredients are missing"
      );
    }

    // Easily look up an ingredient by its ID.
    const ingredientMap = new Map(
      ingredients.map((ingredient) => [
        String(ingredient.id),
        ingredient,
      ])
    );

    // 5. Calculate and validate ALL deductions.
    const deductions = recipeRows.map((recipeRow) => {
      const ingredient = ingredientMap.get(
        String(recipeRow.ingredient_id)
      );

      if (!ingredient || !ingredient.is_active) {
        throw new HttpError(
          409,
          "A required ingredient is archived"
        );
      }

      const required = new Decimal(recipeRow.quantity)
        .times(orderItem.quantity);

      const available = new Decimal(
        ingredient.quantity_on_hand
      );

      if (available.lessThan(required)) {
        throw new HttpError(
          409,
          `Insufficient ${ingredient.name}. ` +
          `Required: ${required.toString()} ${ingredient.unit}, ` +
          `Available: ${available.toString()} ${ingredient.unit}`
        );
      }

      return {
        ingredient,
        required,
        remaining: available.minus(required),
      };
    });

    // 6. Apply deductions and create ledger entries.
    for (const deduction of deductions) {
      await deduction.ingredient.update(
        {
          quantity_on_hand: deduction.remaining.toFixed(3),
        },
        { transaction }
      );

      await StockMovement.create(
        {
          ingredient_id: deduction.ingredient.id,
          order_item_id: orderItem.id,
          movement_type: "preparation",
          quantity_delta: deduction.required
            .negated()
            .toFixed(3),
          unit_cost: deduction.ingredient.cost_per_unit,
          note: `Prepared order item ${orderItem.id}`,
        },
        { transaction }
      );
    }

    // 7. Mark the order item Prepared.
    await orderItem.update(
      {
        status: "prepared",
        prepared_at: new Date(),
      },
      { transaction }
    );

    return {
      order_item_id: orderItem.id,
      status: "prepared",
      already_prepared: false,
      deductions: deductions.map((d) => ({
        ingredient: d.ingredient.name,
        quantity_deducted: d.required.toFixed(3),
        unit: d.ingredient.unit,
      })),
    };
  });
}

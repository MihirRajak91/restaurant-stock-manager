
import Decimal from "decimal.js";

export function formatMenuItem(menuItem) {
  let totalCost = new Decimal(0);

  const recipe = menuItem.ingredients.map((ingredient) => {
    // Quantity is stored in the junction table.
    const quantity = ingredient.RecipeIngredient.quantity;

    const unitCost = ingredient.cost_per_unit;

    // Calculate cost of this ingredient in the recipe.
    const lineCost = new Decimal(quantity).times(unitCost);

    totalCost = totalCost.plus(lineCost);

    return {
      ingredient_id: ingredient.id,
      ingredient_name: ingredient.name,
      unit: ingredient.unit,
      quantity,
      cost_per_unit: unitCost,
      line_cost: lineCost.toFixed(2),
    };
  });

  const sellingPrice = new Decimal(menuItem.selling_price);

  const grossProfit = sellingPrice.minus(totalCost);

  const foodCostPercent = sellingPrice.greaterThan(0)
    ? totalCost.dividedBy(sellingPrice).times(100)
    : null;

  return {
    id: menuItem.id,
    name: menuItem.name,
    category: menuItem.category,
    selling_price: menuItem.selling_price,
    is_active: menuItem.is_active,

    recipe,

    ingredient_cost: totalCost.toFixed(2),
    gross_profit: grossProfit.toFixed(2),
    food_cost_percent: foodCostPercent
      ? foodCostPercent.toFixed(2)
      : null,
  };
}

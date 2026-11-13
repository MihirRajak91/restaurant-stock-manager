
import MenuItem from "./MenuItem.js";
import Ingredient from "./Ingredient.js";
import RecipeIngredient from "./RecipeIngredient.js";
import Order from "./Order.js";
import OrderItem from "./OrderItem.js";
import StockMovement from "./StockMovement.js";

// One menu item can contain many ingredients.
MenuItem.belongsToMany(Ingredient, {
  through: RecipeIngredient,
  as: "ingredients",
  foreignKey: "menu_item_id",
  otherKey: "ingredient_id",
});

// One ingredient can be used in many menu items.
Ingredient.belongsToMany(MenuItem, {
  through: RecipeIngredient,
  as: "menuItems",
  foreignKey: "ingredient_id",
  otherKey: "menu_item_id",
});


// An order contains many order items.
Order.hasMany(OrderItem, {
  as: "items",
  foreignKey: "order_id",
});

OrderItem.belongsTo(Order, {
  as: "order",
  foreignKey: "order_id",
});

// Every order item refers to a menu item.
OrderItem.belongsTo(MenuItem, {
  as: "menuItem",
  foreignKey: "menu_item_id",
});

// Every stock movement belongs to an ingredient.
StockMovement.belongsTo(Ingredient, {
  as: "ingredient",
  foreignKey: "ingredient_id",
});

// A prepared item can produce multiple stock movements.
OrderItem.hasMany(StockMovement, {
  as: "movements",
  foreignKey: "order_item_id",
});


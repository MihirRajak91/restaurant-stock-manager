
import MenuItem from "./MenuItem.js";
import Ingredient from "./Ingredient.js";
import RecipeIngredient from "./RecipeIngredient.js";
import Order from "./Order.js";
import OrderItem from "./OrderItem.js";
import StockMovement from "./StockMovement.js";
import Supplier from "./Supplier.js";
import PurchaseOrder from "./PurchaseOrder.js";
import PurchaseOrderItem from "./PurchaseOrderItem.js";
import PurchaseReceipt from "./PurchaseReceipt.js";
import InventoryEvent from "./InventoryEvent.js";

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

// One supplier has many purchase orders.
Supplier.hasMany(PurchaseOrder, {
  as: "purchaseOrders",
  foreignKey: "supplier_id",
});

PurchaseOrder.belongsTo(Supplier, {
  as: "supplier",
  foreignKey: "supplier_id",
});

// Each purchase order has ingredient lines.
PurchaseOrder.hasMany(PurchaseOrderItem, {
  as: "items",
  foreignKey: "purchase_order_id",
});

PurchaseOrderItem.belongsTo(PurchaseOrder, {
  as: "purchaseOrder",
  foreignKey: "purchase_order_id",
});

// Each purchase line refers to an ingredient.
PurchaseOrderItem.belongsTo(Ingredient, {
  as: "ingredient",
  foreignKey: "ingredient_id",
});

// A purchase line can have multiple receipts.
PurchaseOrderItem.hasMany(PurchaseReceipt, {
  as: "receipts",
  foreignKey: "purchase_order_item_id",
});

PurchaseReceipt.belongsTo(PurchaseOrderItem, {
  as: "purchaseOrderItem",
  foreignKey: "purchase_order_item_id",
});

// The stock movement identifies its receipt.
StockMovement.belongsTo(PurchaseReceipt, {
  as: "purchaseReceipt",
  foreignKey: "purchase_receipt_id",
});

// Every event belongs to an ingredient.
InventoryEvent.belongsTo(Ingredient, {
  as: "ingredient",
  foreignKey: "ingredient_id",
});

// One event can have a stock movement.
// A zero-variance count has no movement.
InventoryEvent.hasOne(StockMovement, {
  as: "movement",
  foreignKey: "inventory_event_id",
});

StockMovement.belongsTo(InventoryEvent, {
  as: "inventoryEvent",
  foreignKey: "inventory_event_id",
});

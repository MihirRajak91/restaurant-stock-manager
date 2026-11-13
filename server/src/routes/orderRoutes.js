
import { Router } from "express";

import sequelize from "../db.js";
import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import MenuItem from "../models/MenuItem.js";
import { writeAudit } from "../services/auditService.js";
import {
  authenticate,
  allowRoles,
} from "../middleware/auth.js";

import {
  prepareOrderItem,
  HttpError,
} from "../services/prepareOrderItem.js";

const router = Router();
router.use(authenticate);

// GET all kitchen tickets.
// All three roles may view kitchen tickets.
router.get(
  "/orders",
  allowRoles("admin", "manager", "kitchen"),
  async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [{
        model: OrderItem,
        as: "items",
        include: [{
          model: MenuItem,
          as: "menuItem",
          attributes: ["id", "name", "category"],
        }],
      }],
      order: [["created_at", "DESC"]],
    });

    return res.json(orders);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to load orders",
    });
  }
});

// POST a new kitchen ticket (one type of menu item).
// Only Admin and Manager may create kitchen tickets.
router.post(
  "/orders",
  allowRoles("admin", "manager"),
  async (req, res) => {
  const menuItemId = Number(req.body?.menu_item_id);
  const quantity = Number(req.body?.quantity);

  if (
    !Number.isSafeInteger(menuItemId) ||
    menuItemId <= 0 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 20
  ) {
    return res.status(400).json({
      message: "Select a valid menu item and quantity (1–20)",
    });
  }

  try {
    const result = await sequelize.transaction(
      async (transaction) => {
        const menuItem = await MenuItem.findByPk(
          menuItemId,
          { transaction }
        );

        if (!menuItem || !menuItem.is_active) {
          throw new HttpError(
            404,
            "Active menu item not found"
          );
        }

        // Create kitchen ticket.
        const order = await Order.create(
          {},
          { transaction }
        );

        // Create the item and snapshot its selling price.
        const item = await OrderItem.create(
          {
            order_id: order.id,
            menu_item_id: menuItem.id,
            quantity,
            unit_price: menuItem.selling_price,
            status: "pending",
          },
          { transaction }
        );

                await writeAudit({
        transaction,
        actor: req.user,
        action: "order.created",
        entityType: "order",
        entityId: order.id,
        details: {
            order_item_id: String(item.id),
            menu_item_id: String(menuItem.id),
            servings: item.quantity,
        },
        });

        return {
          order_id: order.id,
          order_item_id: item.id,
          status: item.status,
        };
      }
    );

    return res.status(201).json(result);
  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      message: error.status
        ? error.message
        : "Failed to create order",
    });
  }
});

// POST to mark an order item Prepared.
// All three roles may mark a kitchen item Prepared.
router.post(
  "/order-items/:id/prepare",
  allowRoles("admin", "manager", "kitchen"),
  async (req, res) => {
  const itemId = Number(req.params.id);

  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return res.status(400).json({
      message: "Invalid order item ID",
    });
  }

  try {
    const result = await prepareOrderItem(
        itemId,
        req.user
);

    return res.json(result);
  } catch (error) {
    console.error("Preparation error:", error);

    return res.status(error.status || 500).json({
      message: error instanceof HttpError
        ? error.message
        : "Failed to prepare order item",
    });
  }
});

export default router;

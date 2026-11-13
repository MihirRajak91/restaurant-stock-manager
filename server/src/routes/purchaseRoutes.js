
import { Router } from "express";
import Decimal from "decimal.js";
import { UniqueConstraintError } from "sequelize";
import { authenticate, allowRoles } from "../middleware/auth.js";

import sequelize from "../db.js";
import Supplier from "../models/Supplier.js";
import Ingredient from "../models/Ingredient.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import PurchaseOrderItem from "../models/PurchaseOrderItem.js";

import {
  receivePurchase,
  PurchaseError,
} from "../services/receivePurchase.js";

const router = Router();

router.use(authenticate, allowRoles("admin", "manager"));

const quantityPattern = /^(0|[1-9]\d{0,8})(\.\d{1,3})?$/;
const pricePattern = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

// Map ingredient base units to allowed purchase units.
const conversions = {
  ml: { ml: "1", l: "1000" },
  g: { g: "1", kg: "1000" },
  pcs: { pcs: "1" },
};

// GET suppliers
router.get("/suppliers", async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({
      order: [["name", "ASC"]],
    });

    res.json(suppliers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load suppliers" });
  }
});

// POST supplier
router.post("/suppliers", async (req, res) => {
  try {
    const { name, phone } = req.body ?? {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      (phone != null &&
        (typeof phone !== "string" || phone.length > 30))
    ) {
      return res.status(400).json({
        message: "Enter valid supplier details",
      });
    }

    const supplier = await Supplier.create({
      name: name.trim(),
      phone: phone?.trim() || null,
    });

    return res.status(201).json(supplier);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        message: "Supplier name already exists",
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Failed to create supplier",
    });
  }
});

// GET purchase orders with their ingredient lines
router.get("/orders", async (req, res) => {
  try {
    const orders = await PurchaseOrder.findAll({
      include: [
        {
          model: Supplier,
          as: "supplier",
          attributes: ["id", "name"],
        },
        {
          model: PurchaseOrderItem,
          as: "items",
          include: [{
            model: Ingredient,
            as: "ingredient",
            attributes: ["id", "name", "unit"],
          }],
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.json(orders);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to load purchase orders",
    });
  }
});

// POST purchase order with one ingredient line
router.post("/orders", async (req, res) => {
  const {
    supplier_id,
    ingredient_id,
    purchase_unit,
    quantity_ordered,
    unit_price,
  } = req.body ?? {};

  const supplierId = Number(supplier_id);
  const ingredientId = Number(ingredient_id);

  if (
    !Number.isSafeInteger(supplierId) ||
    supplierId <= 0 ||
    !Number.isSafeInteger(ingredientId) ||
    ingredientId <= 0 ||
    typeof quantity_ordered !== "string" ||
    !quantityPattern.test(quantity_ordered) ||
    !new Decimal(quantity_ordered).greaterThan(0) ||
    typeof unit_price !== "string" ||
    !pricePattern.test(unit_price)
  )
  
    await writeAudit({
    transaction,
    actor: req.user,
    action: "purchase_order.created",
    entityType: "purchase_order",
    entityId: order.id,
    details: {
        supplier_id: String(supplier.id),
        purchase_order_item_id: String(item.id),
        ingredient_id: String(ingredient.id),
        quantity_ordered: item.quantity_ordered,
        purchase_unit: item.purchase_unit,
    },
    });
 
  {
    return res.status(400).json({
      message: "Invalid purchase order details",
    });
  }

  try {
    const result = await sequelize.transaction(
      async (transaction) => {
        const supplier = await Supplier.findByPk(supplierId, {
          transaction,
        });

        const ingredient = await Ingredient.findByPk(
          ingredientId,
          { transaction }
        );

        if (!supplier || !supplier.is_active) {
          throw new PurchaseError(400, "Invalid supplier");
        }

        if (!ingredient || !ingredient.is_active) {
          throw new PurchaseError(400, "Invalid ingredient");
        }

        const factor =
          conversions[ingredient.unit]?.[purchase_unit];

        if (!factor) {
          throw new PurchaseError(
            400,
            "Purchase unit is not compatible with ingredient unit"
          );
        }

        const order = await PurchaseOrder.create(
          { supplier_id: supplierId },
          { transaction }
        );

        const item = await PurchaseOrderItem.create(
          {
            purchase_order_id: order.id,
            ingredient_id: ingredientId,
            purchase_unit,
            conversion_factor: factor,
            quantity_ordered,
            quantity_received: "0",
            unit_price,
          },
          { transaction }
        );

        return {
          purchase_order_id: order.id,
          purchase_order_item_id: item.id,
          quantity_ordered: item.quantity_ordered,
          purchase_unit: item.purchase_unit,
        };
      }
    );

    return res.status(201).json(result);
  } catch (error) {
    console.error(error);

    return res.status(error instanceof PurchaseError
      ? error.status : 500).json({
      message: error instanceof PurchaseError
        ? error.message
        : "Failed to create purchase order",
    });
  }
});

// POST receipt for a purchase order line
router.post("/items/:id/receive", async (req, res) => {
  const itemId = Number(req.params.id);

  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return res.status(400).json({
      message: "Invalid purchase order item ID",
    });
  }

  try {
    const result = await receivePurchase({
      itemId,
      quantity: req.body?.quantity_received,
      idempotencyKey: req.body?.idempotency_key,
      actor: req.user,
    });

    return res.json(result);
  } catch (error) {
    console.error(error);

    return res.status(error instanceof PurchaseError
      ? error.status : 500).json({
      message: error instanceof PurchaseError
        ? error.message
        : "Failed to receive stock",
    });
  }
});

export default router;

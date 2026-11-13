
import { Router } from "express";

import InventoryEvent from "../models/InventoryEvent.js";
import Ingredient from "../models/Ingredient.js";

import {
  recordInventoryEvent,
  InventoryError,
} from "../services/recordInventoryEvent.js";

const router = Router();

// Retrieve recent waste and stock-count events.
router.get("/", async (req, res) => {
  try {
    const events = await InventoryEvent.findAll({
      attributes: [
        "id",
        "event_type",
        "reason",
        "entered_quantity",
        "quantity_before",
        "quantity_after",
        "quantity_delta",
        "unit_cost",
        "note",
        "created_at",
      ],
      include: [{
        model: Ingredient,
        as: "ingredient",
        attributes: ["id", "name", "unit"],
      }],
      order: [["id", "DESC"]],
      limit: 100,
    });

    return res.json(events);
  } catch (error) {
    console.error("Load inventory events:", error);

    return res.status(500).json({
      message: "Failed to load inventory events",
    });
  }
});

// Record waste or a stock count.
router.post("/", async (req, res) => {
  try {
    const result = await recordInventoryEvent(
      req.body ?? {}
    );

    return res
      .status(result.already_recorded ? 200 : 201)
      .json(result);
  } catch (error) {
    if (error instanceof InventoryError) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    console.error("Inventory event failed:", error);

    return res.status(500).json({
      message: "Failed to record inventory event",
    });
  }
});

export default router;

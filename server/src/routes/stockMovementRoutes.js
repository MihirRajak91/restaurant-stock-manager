import { Router } from "express";
import { authenticate, allowRoles } from "../middleware/auth.js";
import Ingredient from "../models/Ingredient.js";
import StockMovement from "../models/StockMovement.js";

const router = Router();

router.use(authenticate, allowRoles("admin", "manager"));

// GET recent inventory movement history.
router.get("/", async (req, res) => {
  try {
    const movements = await StockMovement.findAll({
      include: [{
        model: Ingredient,
        as: "ingredient",
        attributes: ["name", "unit"],
      }],
      order: [["id", "DESC"]],
      limit: 50,
    });

    return res.json(movements);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to load stock movements",
    });
  }
});

export default router;

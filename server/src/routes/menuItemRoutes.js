import { Router } from "express";
import pkg from "sequelize";
import Decimal from "decimal.js";
import sequelize from "../db.js";
import Ingredient from "../models/Ingredient.js";
import MenuItem from "../models/MenuItem.js";
import RecipeIngredient from "../models/RecipeIngredient.js";
import { formatMenuItem } from "../services/recipeCosting.js";
import menuCategories from "../../../shared/menuCategories.json" with { type: "json" };

const { UniqueConstraintError } = pkg;
const router = Router();

router.get("/", async (req, res) => {
  try {
    const menuItems = await MenuItem.findAll({
      include: [
        {
          model: Ingredient,
          as: "ingredients",
          through: {
            attributes: ["quantity"],
          },
        },
      ],
      order: [["name", "ASC"]],
    });

    const result = menuItems.map(formatMenuItem);

    return res.json(result);
  } catch (error) {
    console.error("Fetch menu items error:", error);

    return res.status(500).json({
      message: "Failed to fetch menu items",
    });
  }
});


router.post("/", async (req, res) => {
  try {
    const {
      name,
      category,
      selling_price,
      recipe,
    } = req.body ?? {};

    // Validate the menu item.
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        message: "Enter a valid menu item name",
      });
    }

    if (
      typeof category !== "string" ||
      !menuCategories.includes(category.trim())
    ) {
      return res.status(400).json({
        message: "Select a valid menu category",
      });
    }

    // Validate selling price: NUMERIC(12,2).
    const moneyPattern = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

    if (
      typeof selling_price !== "string" ||
      !moneyPattern.test(selling_price)
    ) {
      return res.status(400).json({
        message: "Enter a valid selling price",
      });
    }

    // A recipe must contain at least one ingredient.
    if (
      !Array.isArray(recipe) ||
      recipe.length === 0 ||
      recipe.length > 50
    ) {
      return res.status(400).json({
        message: "Add between 1 and 50 recipe ingredients",
      });
    }

    const quantityPattern = /^(0|[1-9]\d{0,8})(\.\d{1,3})?$/;

    // Validate every ingredient row.
    for (const row of recipe) {
      if (
        !row ||
        !Number.isSafeInteger(row.ingredient_id) ||
        row.ingredient_id <= 0 ||
        typeof row.quantity !== "string" ||
        !quantityPattern.test(row.quantity) ||
        !new Decimal(row.quantity).greaterThan(0)
      ) {
        return res.status(400).json({
          message: "Invalid recipe ingredient or quantity",
        });
      }
    }

    const ingredientIds = recipe.map(
      (row) => row.ingredient_id
    );

    // Prevent duplicate ingredients in the same recipe.
    if (new Set(ingredientIds).size !== ingredientIds.length) {
      return res.status(400).json({
        message: "An ingredient cannot appear twice",
      });
    }

    // Save the menu item and its recipe atomically.
    const menuItemId = await sequelize.transaction(
      async (transaction) => {
        // Verify ingredients exist and are active.
        const ingredients = await Ingredient.findAll({
          where: {
            id: ingredientIds,
            is_active: true,
          },
          order: [["id", "ASC"]],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (ingredients.length !== ingredientIds.length) {
          const error = new Error(
            "One or more ingredients are missing or archived"
          );
          error.status = 400;
          throw error;
        }

        // Create the menu item.
        const menuItem = await MenuItem.create(
          {
            name: name.trim(),
            category: category.trim(),
            selling_price,
          },
          { transaction }
        );

        // Create its recipe ingredient rows.
        await RecipeIngredient.bulkCreate(
          recipe.map((row) => ({
            menu_item_id: menuItem.id,
            ingredient_id: row.ingredient_id,
            quantity: row.quantity,
          })),
          { transaction }
        );

        return menuItem.id;
      }
    );

    // Read the completed recipe after the transaction.
    const created = await MenuItem.findByPk(menuItemId, {
      include: [
        {
          model: Ingredient,
          as: "ingredients",
          through: {
            attributes: ["quantity"],
          },
        },
      ],
    });

    return res.status(201).json(formatMenuItem(created));

  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        message: "A menu item with this name already exists",
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("Create menu item error:", error);

    return res.status(500).json({
      message: "Failed to create menu item",
    });
  }
});

export default router;

import { Router } from "express";
import pkg from "sequelize";
import Decimal from "decimal.js";
import sequelize from "../db.js";
import Ingredient from "../models/Ingredient.js";
import StockMovement from "../models/StockMovement.js";
import {
  authenticate,
  allowRoles,
} from "../middleware/auth.js";

const { Op, UniqueConstraintError } = pkg;
const router = Router();

router.use(
  authenticate,
  allowRoles("admin", "manager")
);

const validQuantity = /^\d{1,9}(\.\d{1,3})?$/;
const validCost = /^\d{1,8}(\.\d{1,4})?$/;

//Get all ingredients using Sequelize

router.get("/", async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim();
    const status = req.query.status ?? "active";

    if (search.length > 100) {
      return res.status(400).json({
        message: "Search must be 100 characters or less",
      });
    }

    if (!["active", "archived", "all"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status filter",
      });
    }

    const where = {};

    if (status === "active") {
      where.is_active = true;
    }

    if (status === "archived") {
      where.is_active = false;
    }

    if (search) {
      where.name = {
        [Op.iLike]: `%${search}%`,
      };
    }

    const ingredients = await Ingredient.findAll({
      where,
      order: [["name", "ASC"]],
    });

    return res.json(ingredients);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to fetch ingredients",
    });
  }
});


router.post("/", async (req,res) => {
    try{
        const {
            name,
            unit,
            quantity_on_hand,
            reorder_level,
            cost_per_unit,
        } = req.body ?? {};

        //Validate
        if (
            typeof name !== "string" || 
            !name.trim() ||
            name.trim().length > 100
        ){
            return res.status(400).json({
                message: "Enter a Valid ingredient name (1-100 characters)",
            });
        }

        if (
            typeof quantity_on_hand !== "string" ||
            !validQuantity.test(quantity_on_hand) ||
            typeof reorder_level !== "string" ||
            !validQuantity.test(reorder_level)
        ){
            return res.status(400).json({
                message: "quantities must be non-negative with up to 3 decimal places",
            });
        }

        //validate cost and its deciaml precision

        if(
            typeof cost_per_unit !== "string" ||
            !validCost.test(cost_per_unit)
        ){
            return res.status(400).json({
                message: "Cost must be non negative with up to 4 decimal places",
            });
        }

        const ingredient = await sequelize.transaction(
            async (transaction) => {
                const created = await Ingredient.create(
                    {
                        name: name.trim(),
                        unit,
                        quantity_on_hand,
                        reorder_level,
                        cost_per_unit,
                    },
                    { transaction }
                );

                // Record the opening balance in the ledger.
                if (new Decimal(quantity_on_hand).greaterThan(0)) {
                    await StockMovement.create(
                        {
                            ingredient_id: created.id,
                            movement_type: "opening",
                            quantity_delta: new Decimal(
                                quantity_on_hand
                            ).toFixed(3),
                            unit_cost: cost_per_unit,
                            note: "Opening stock on ingredient creation",
                        },
                        { transaction }
                    );
                }

                return created;
            }
        );
        
        return res.status(201).json(ingredient);
    }catch (error){
        if (error instanceof UniqueConstraintError){
            return res.status(409).json({
                message: "An ingredient with this name already exists",
            });
        }
        console.error("Cretate ingredient error", error);
        
        return res.status(500).json({
            message:"Failed to create ingredient",
        });
    }
});


router.patch("/:id", async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "reorder_level",
      "cost_per_unit",
    ];

    const body = req.body;

    if (!body || typeof body !== "object" ||
        Array.isArray(body)) {
      return res.status(400).json({
        message: "A valid JSON object is required",
      });
    }

    const fields = Object.keys(body);

    if (
      fields.length === 0 ||
      fields.some((field) => !allowedFields.includes(field))
    ) {
      return res.status(400).json({
        message: "Only name, reorder level and cost can be edited",
      });
    }

    const updates = {};

    if (fields.includes("name")) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim() ||
        body.name.trim().length > 100
      ) {
        return res.status(400).json({
          message: "Enter a valid ingredient name",
        });
      }

      updates.name = body.name.trim();
    }

    if (fields.includes("reorder_level")) {
      const valid = /^\d{1,9}(\.\d{1,3})?$/;

      if (
        typeof body.reorder_level !== "string" ||
        !valid.test(body.reorder_level)
      ) {
        return res.status(400).json({
          message: "Invalid reorder level",
        });
      }

      updates.reorder_level = body.reorder_level;
    }

    if (fields.includes("cost_per_unit")) {
      const valid = /^\d{1,8}(\.\d{1,4})?$/;

      if (
        typeof body.cost_per_unit !== "string" ||
        !valid.test(body.cost_per_unit)
      ) {
        return res.status(400).json({
          message: "Invalid ingredient cost",
        });
      }

      updates.cost_per_unit = body.cost_per_unit;
    }

    const ingredient = await Ingredient.findByPk(
      req.params.id
    );

    if (!ingredient) {
      return res.status(404).json({
        message: "Ingredient not found",
      });
    }

    if (!ingredient.is_active) {
      return res.status(409).json({
        message: "Restore the ingredient before editing",
      });
    }

    await ingredient.update(updates);

    return res.json(ingredient);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        message: "Ingredient name already exists",
      });
    }

    console.error(error);

    return res.status(500).json({
      message: "Failed to update ingredient",
    });
  }
});


router.patch("/:id/archive", async (req, res) => {
  try {
    const result = await sequelize.transaction(
      async (transaction) => {
        const ingredient = await Ingredient.findByPk(
          req.params.id,
          {
            transaction,
            lock: transaction.LOCK.UPDATE,
          }
        );

        if (!ingredient) {
          return {
            status: 404,
            body: { message: "Ingredient not found" },
          };
        }

        if (!ingredient.is_active) {
          return {
            status: 409,
            body: { message: "Already archived" },
          };
        }

        if (Number(ingredient.quantity_on_hand) !== 0) {
          return {
            status: 409,
            body: {
              message: "Stock must be zero before archiving",
            },
          };
        }

        await ingredient.update(
          {
            is_active: false,
            archived_at: new Date(),
          },
          { transaction }
        );

        return {
          status: 200,
          body: ingredient,
        };
      }
    );

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to archive ingredient",
    });
  }
});


router.patch("/:id/restore", async (req, res) => {
  try {
    const ingredient = await Ingredient.findByPk(
      req.params.id
    );

    if (!ingredient) {
      return res.status(404).json({
        message: "Ingredient not found",
      });
    }

    if (ingredient.is_active) {
      return res.status(409).json({
        message: "Ingredient is already active",
      });
    }

    await ingredient.update({
      is_active: true,
      archived_at: null,
    });

    return res.json(ingredient);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to restore ingredient",
    });
  }
});

export default router;

import express from "express";
import cors from "cors";
import pkg from "sequelize";
import sequelize from "./db.js";
import Ingredient from "../models/Ingredient.js";

const { Op, UniqueConstraintError } = pkg;

const validQuantity = /^\d{1,9}(\.\d{1,3})?$/;
const validCost = /^\d{1,8}(\.\d{1,4})?$/;

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Allow the Vite dev server on any localhost port (5173, 5174, ...)
app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1):\d+$/ }));
app.use(express.json());

app.get("/api/health", (req,res) => {
    res.json({
        status:"ok",
        message: "Restauramt Stock API is running",
    });
});

//Get all ingredients using Sequelize

app.get("/api/ingredients", async (req, res) => {
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


app.post("/api/ingredients", async (req,res) => {
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

        const ingredient = await Ingredient.create({
            name: name.trim(),
            unit,
            quantity_on_hand,
            reorder_level,
            cost_per_unit,
        });
        
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


app.patch("/api/ingredients/:id", async (req, res) => {
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


async function startServer(){
    try{
        await sequelize.authenticate();

        console.log("PostgresSQL connected succesfully");

        app.listen(PORT,() => {
            console.log(`Server running on port ${PORT}`);
        }) ;
    }catch (error){
        console.error("Database Connection Failed:", error);
        process.exit(1);
    }
}

startServer();
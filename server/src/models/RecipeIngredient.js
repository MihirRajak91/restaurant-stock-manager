
import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const RecipeIngredient = sequelize.define(
  "RecipeIngredient",
  {
    menu_item_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false,
    },

    ingredient_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      allowNull: false,
    },

    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
  },
  {
    tableName: "recipe_ingredients",
    timestamps: false,
  }
);

export default RecipeIngredient;

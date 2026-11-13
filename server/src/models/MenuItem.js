
import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const MenuItem = sequelize.define(
  "MenuItem",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    selling_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "menu_items",
    timestamps: false,
  }
);

export default MenuItem;

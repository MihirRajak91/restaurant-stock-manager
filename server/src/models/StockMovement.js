
import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const StockMovement = sequelize.define("StockMovement", {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },

  ingredient_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  order_item_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },

  movement_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },

  quantity_delta: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
  },

  unit_cost: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false,
  },

  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "stock_movements",
  timestamps: false,
});

export default StockMovement;

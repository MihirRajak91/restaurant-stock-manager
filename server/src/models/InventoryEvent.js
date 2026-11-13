
import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const InventoryEvent = sequelize.define(
  "InventoryEvent",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    ingredient_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

    event_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },

    reason: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    entered_quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },

    quantity_before: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },

    quantity_after: {
      type: DataTypes.DECIMAL(12, 3),
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

    idempotency_key: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "inventory_events",
    timestamps: false,
  }
);

export default InventoryEvent;


import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const PurchaseOrderItem = sequelize.define(
  "PurchaseOrderItem",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    purchase_order_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    ingredient_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    purchase_unit: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    conversion_factor: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    quantity_ordered: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    quantity_received: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
    },
    unit_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
  },
  {
    tableName: "purchase_order_items",
    timestamps: false,
  }
);

export default PurchaseOrderItem;

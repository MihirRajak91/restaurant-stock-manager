
import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const PurchaseOrder = sequelize.define("PurchaseOrder", {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  supplier_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "purchase_orders",
  timestamps: false,
});

export default PurchaseOrder;

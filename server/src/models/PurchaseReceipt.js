
import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const PurchaseReceipt = sequelize.define("PurchaseReceipt", {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  purchase_order_item_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  received_by_user_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  quantity_received: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
  },
  base_quantity: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
  },
  unit_cost_per_base: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false,
  },
  idempotency_key: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  received_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "purchase_receipts",
  timestamps: false,
});

export default PurchaseReceipt;

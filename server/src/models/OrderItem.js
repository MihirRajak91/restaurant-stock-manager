
import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const OrderItem = sequelize.define("OrderItem", {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },

  order_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  menu_item_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  unit_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },

  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "pending",
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },

  prepared_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: "order_items",
  timestamps: false,
});

export default OrderItem;

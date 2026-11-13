
import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const Order = sequelize.define("Order", {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "orders",
  timestamps: false,
});

export default Order;

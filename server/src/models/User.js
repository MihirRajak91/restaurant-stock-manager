
import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const User = sequelize.define("User", {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },

  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },

  email: {
    type: DataTypes.STRING(254),
    allowNull: false,
    unique: true,
  },

  password_hash: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  role: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },

  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

  session_version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "users",
  timestamps: false,
});

export default User;

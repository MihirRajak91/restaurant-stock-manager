
import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const AuditLog = sequelize.define("AuditLog", {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },

  actor_user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  actor_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },

  actor_role: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },

  action: {
    type: DataTypes.STRING(80),
    allowNull: false,
  },

  entity_type: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },

  entity_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  details: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "audit_logs",
  timestamps: false,
});

export default AuditLog;

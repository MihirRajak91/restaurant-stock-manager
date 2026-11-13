import pkg from "sequelize";
const { DataTypes } = pkg;
import sequelize from "../db.js";

const Ingredient = sequelize.define(
    "Ingredient",
    {
        id:{
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
        },

        name:{
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },

        unit:{
            type: DataTypes.STRING(10),
            allowNull: false,
        },

        quantity_on_hand: {
            type: DataTypes.DECIMAL(12,3),
            allowNull: false,
            defaultValue: 0,
        },

        reorder_level: {
            type: DataTypes.DECIMAL(12,3),
            allowNull: false,
            defaultValue: 0,
        },
        
        cost_per_unit:{
            type: DataTypes.DECIMAL(12,4),
            allowNull: false,
            defaultValue: 0,
        },

        created_at:{
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },

        is_active:{
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        archived_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
        },
    },
    {
        tableName: "ingredients",
        timestamps: false,
    },
    
);

export default Ingredient;

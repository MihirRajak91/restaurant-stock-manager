import "dotenv/config";
import pkg from "sequelize";
const { Sequelize } = pkg;

const sequelize = new Sequelize({
    dialect: "postgres",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD || null,
    logging: false,
});

export default  sequelize;

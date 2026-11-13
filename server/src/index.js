import express from "express";
import cors from "cors";
import sequelize from "./db.js";
import ingredientRoutes from "./routes/ingredientRoutes.js";
import menuItemRoutes from "./routes/menuItemRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import inventoryEventRoutes from "./routes/inventoryEventRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";

// Register associations before running associated queries.
import "./models/associations.js";
import StockMovement from "./models/StockMovement.js";
import Decimal from "decimal.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Allow the Vite dev server on any localhost port (5173, 5174, ...)
app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1):\d+$/ }));
app.use(express.json());

app.use("/api", orderRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/inventory-events", inventoryEventRoutes);

app.get("/api/health", (req,res) => {
    res.json({
        status:"ok",
        message: "Restauramt Stock API is running",
    });
});

app.use("/api/ingredients", ingredientRoutes);
app.use("/api/menu-items", menuItemRoutes);
app.use("/api/dashboard", dashboardRoutes);

async function startServer(){
    try{
        await sequelize.authenticate();

        console.log("PostgresSQL connected succesfully");

        app.listen(PORT,() => {
            console.log(`Server running on port ${PORT}`);
        }) ;
    }catch (error){
        console.error("Database Connection Failed:", error);
        process.exit(1);
    }
}

startServer();

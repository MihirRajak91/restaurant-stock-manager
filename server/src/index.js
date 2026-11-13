import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import sequelize from "./db.js";
import ingredientRoutes from "./routes/ingredientRoutes.js";
import menuItemRoutes from "./routes/menuItemRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import inventoryEventRoutes from "./routes/inventoryEventRoutes.js";
import stockMovementRoutes from "./routes/stockMovementRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";

// Register associations before running associated queries.
import "./models/associations.js";
import StockMovement from "./models/StockMovement.js";
import Decimal from "decimal.js";


const app = express();

const clientOrigin =
  process.env.CLIENT_ORIGIN || "http://localhost:5173";

// HTTP security headers
app.use(helmet());

// Allow credentialed requests from our React app.
app.use(cors({
  origin: clientOrigin,
  credentials: true,
}));

// Parse cookies and JSON request bodies.
app.use(cookieParser());
app.use(express.json({ limit: "20kb" }));

// Reject browser state-changing requests from other origins.
app.use("/api", (req, res, next) => {
  const stateChanging = [
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ].includes(req.method);

  if (!stateChanging) {
    return next();
  }

  if (req.get("Origin") !== clientOrigin) {
    return res.status(403).json({
      message: "Untrusted request origin",
    });
  }

  return next();
});

// Register authentication endpoints.
app.use("/api/auth", authRoutes);

const PORT = Number(process.env.PORT) || 5000;

// Allow the Vite dev server on any localhost port (5173, 5174, ...)
app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1):\d+$/ }));
app.use(express.json());

app.use("/api", orderRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/inventory-events", inventoryEventRoutes);
app.use("/api/stock-movements", stockMovementRoutes);

app.get("/api/health", (req,res) => {
    res.json({
        status:"ok",
        message: "Restauramt Stock API is running",
    });
});

app.use("/api/ingredients", ingredientRoutes);
app.use("/api/menu-items", menuItemRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);

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

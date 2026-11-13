
import { Router } from "express";

import { getDashboardData } from
  "../services/dashboardService.js";

const router = Router();

// GET /api/dashboard
router.get("/", async (req, res) => {
  try {
    const dashboard = await getDashboardData();

    return res.status(200).json(dashboard);

  } catch (error) {
    console.error("Dashboard error:", error);

    return res.status(500).json({
      message: "Failed to load dashboard",
    });
  }
});

export default router;

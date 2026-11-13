
import { Router } from "express";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { getReportData } from "../services/reportService.js";

const router = Router();

router.use(authenticate, allowRoles("admin", "manager"));

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function getFilters(req) {
  const { from, to } = req.query;

  if (!validDate(from) || !validDate(to)) {
    const error = new Error("Use valid YYYY-MM-DD dates");
    error.status = 400;
    throw error;
  }

  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);

  if (start > end) {
    const error = new Error("Start date must be before end date");
    error.status = 400;
    throw error;
  }

  // Limit reports to at most 366 calendar days.
  if ((end - start) / 86400000 > 365) {
    const error = new Error("Select up to 366 days");
    error.status = 400;
    throw error;
  }

  return { from, to };
}

function handleError(res, error) {
  if (error.status === 400) {
    return res.status(400).json({
      message: error.message,
    });
  }

  console.error("Report error:", error);

  return res.status(500).json({
    message: "Failed to generate report",
  });
}

// CSV file column definitions.
const exportColumns = {
  consumption: [
    ["ingredient_name", "Ingredient", true],
    ["unit", "Unit", true],
    ["quantity_used", "Quantity Used", false],
    ["ingredient_cost", "Ingredient Cost NPR", false],
  ],

  purchases: [
    ["ingredient_name", "Ingredient", true],
    ["unit", "Unit", true],
    ["quantity_received", "Quantity Received", false],
    ["purchase_cost", "Purchase Cost NPR", false],
  ],

  waste: [
    ["ingredient_name", "Ingredient", true],
    ["reason", "Reason", true],
    ["unit", "Unit", true],
    ["quantity_wasted", "Quantity Wasted", false],
    ["waste_cost", "Waste Cost NPR", false],
  ],

  historical_profitability: [
    ["menu_item_name", "Menu Item", true],
    ["servings_prepared", "Servings Prepared", false],
    ["prepared_value", "Prepared Value NPR", false],
    ["ingredient_cost", "Ingredient Cost NPR", false],
    ["gross_contribution", "Gross Contribution NPR", false],
    ["food_cost_percent", "Food Cost Percent", false],
  ],

  current_recipe_profitability: [
    ["menu_item_name", "Menu Item", true],
    ["selling_price", "Selling Price NPR", false],
    ["ingredient_cost", "Recipe Cost NPR", false],
    ["gross_profit", "Estimated Gross Profit NPR", false],
    ["food_cost_percent", "Food Cost Percent", false],
  ],
};

// Escape a CSV cell and neutralize risky text values.
function csvCell(value, isText = false) {
  let cell = String(value ?? "");

  // Prevent user-controlled text being interpreted as a
  // spreadsheet formula when the CSV is opened.
  if (isText && /^[\s\u0000-\u001f]*[=+\-@]/u.test(cell)) {
    cell = "'" + cell;
  }

  return `"${cell.replace(/"/g, '""')}"`;
}

function buildCsv(rows, columns) {
  const header = columns.map((col) =>
    csvCell(col[1])
  ).join(",");

  const dataRows = rows.map((row) =>
    columns.map(([key, , isText]) =>
      csvCell(row[key], isText)
    ).join(",")
  );

  // UTF-8 BOM helps spreadsheet apps recognize the encoding.
  return "\uFEFF" + [header, ...dataRows].join("\r\n");
}

// GET /api/reports?from=2026-11-01&to=2026-11-30
router.get("/", async (req, res) => {
  try {
    const { from, to } = getFilters(req);
    const report = await getReportData(from, to);

    return res.json(report);
  } catch (error) {
    return handleError(res, error);
  }
});

// GET /api/reports/export/consumption?from=...&to=...
router.get("/export/:type", async (req, res) => {
  try {
    const { from, to } = getFilters(req);
    const type = req.params.type;

    if (!Object.hasOwn(exportColumns, type)) {
      return res.status(400).json({
        message: "Invalid report type",
      });
    }

    const report = await getReportData(from, to);
    const csv = buildCsv(report[type], exportColumns[type]);

    const filename = type === "current_recipe_profitability"
      ? `${type}-current.csv`
      : `${type}-${from}-to-${to}.csv`;

    res.setHeader(
      "Content-Type",
      "text/csv; charset=utf-8"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    return res.status(200).send(csv);
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;

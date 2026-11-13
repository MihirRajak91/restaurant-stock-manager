
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api.js";

const API = "http://localhost:5000/api/reports";

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const today = new Date();

const initialDates = {
  from: toDateString(
    new Date(today.getFullYear(), today.getMonth(), 1)
  ),
  to: toDateString(today),
};

const reportSections = [
  {
    type: "consumption",
    title: "Ingredient Consumption",
    columns: [
      ["ingredient_name", "Ingredient"],
      ["quantity_used", "Quantity Used"],
      ["unit", "Unit"],
      ["ingredient_cost", "Cost (NPR)"],
    ],
  },
  {
    type: "purchases",
    title: "Purchase Costs",
    columns: [
      ["ingredient_name", "Ingredient"],
      ["quantity_received", "Received"],
      ["unit", "Inventory Unit"],
      ["purchase_cost", "Cost (NPR)"],
    ],
  },
  {
    type: "waste",
    title: "Waste Costs",
    columns: [
      ["ingredient_name", "Ingredient"],
      ["reason", "Reason"],
      ["quantity_wasted", "Wasted"],
      ["unit", "Unit"],
      ["waste_cost", "Cost (NPR)"],
    ],
  },
  {
    type: "historical_profitability",
    title: "Historical Prepared-Item Profitability",
    columns: [
      ["menu_item_name", "Menu Item"],
      ["servings_prepared", "Servings"],
      ["prepared_value", "Prepared Value (NPR)"],
      ["ingredient_cost", "Ingredient Cost (NPR)"],
      ["gross_contribution", "Gross Contribution (NPR)"],
      ["food_cost_percent", "Food Cost %"],
    ],
  },
  {
    type: "current_recipe_profitability",
    title: "Current Recipe Profitability",
    columns: [
      ["menu_item_name", "Menu Item"],
      ["selling_price", "Selling Price (NPR)"],
      ["ingredient_cost", "Recipe Cost (NPR)"],
      ["gross_profit", "Estimated Gross Profit (NPR)"],
      ["food_cost_percent", "Food Cost %"],
    ],
  },
];

// Reusable component for displaying any report.
function ReportTable({ section, rows, dates }) {
  const params = new URLSearchParams(dates);

  const exportUrl = `${API}/export/${section.type}?${params}`;

  return (
    <section style={{
      marginTop: 30,
      border: "1px solid #ddd",
      padding: 16,
      borderRadius: 8,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <h2>{section.title}</h2>

        <a href={exportUrl}>
          Download CSV
        </a>
      </div>

      {section.type === "current_recipe_profitability" && (
        <p>
          Current estimates — not limited by the date filter.
        </p>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          border="1"
          cellPadding="10"
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              {section.columns.map(([key, label]) => (
                <th key={key}>{label}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {section.columns.map(([key]) => (
                  <td key={key}>
                    {row[key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={section.columns.length}>
                  No records for this report.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportsPage() {
  const [draftDates, setDraftDates] =
    useState({ ...initialDates });

  const [appliedDates, setAppliedDates] =
    useState({ ...initialDates });

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch again when the applied date range changes.
  useEffect(() => {
    const controller = new AbortController();

    async function loadReport() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams(appliedDates);

        const response = await apiFetch(
          `${API}?${params}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load reports"
          );
        }

        if (!controller.signal.aborted) {
          setReport(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadReport();

    return () => controller.abort();
  }, [appliedDates]);

  function applyFilters(event) {
    event.preventDefault();

    if (draftDates.from > draftDates.to) {
      setError("Start date must be before end date");
      return;
    }

    setAppliedDates({ ...draftDates });
  }

  const cards = report ? [
    ["Purchase Costs", report.summary.purchase_cost],
    ["Preparation Ingredient Cost",
      report.summary.consumption_cost],
    ["Waste Costs", report.summary.waste_cost],
    ["Prepared Menu Value", report.summary.prepared_value],
    ["Gross Contribution", report.summary.gross_contribution],
  ] : [];

  return (
    <main style={{
      maxWidth: 1200,
      margin: "40px auto",
      padding: 20,
      fontFamily: "Arial, sans-serif",
    }}>
      <h1>Costing & Inventory Reports</h1>
      <p>Review ingredient usage, purchasing, waste, and costs.</p>

      <form
        onSubmit={applyFilters}
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <label>
          From:
          <input
            type="date"
            required
            value={draftDates.from}
            onChange={(event) => setDraftDates({
              ...draftDates,
              from: event.target.value,
            })}
          />
        </label>

        <label>
          To:
          <input
            type="date"
            required
            value={draftDates.to}
            onChange={(event) => setDraftDates({
              ...draftDates,
              to: event.target.value,
            })}
          />
        </label>

        <button type="submit">Apply Filters</button>
      </form>

      <p style={{ fontSize: 12, color: "#666" }}>
        Reporting timezone: Asia/Kathmandu.
        Selected start and end dates are inclusive.
      </p>

      {error && <p role="alert">{error}</p>}
      {loading && <p>Loading reports...</p>}

      {report && !loading && (
        <>
          <h2>
            Report: {report.period.from}
            {" to "}
            {report.period.to}
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
          }}>
            {cards.map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <p>{label}</p>
                <h3>NPR {value}</h3>
              </div>
            ))}
          </div>

          {reportSections.map((section) => (
            <ReportTable
              key={section.type}
              section={section}
              rows={report[section.type]}
              dates={appliedDates}
            />
          ))}
        </>
      )}
    </main>
  );
}

export default ReportsPage;


import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiFetch } from "../lib/api.js";

const API = "http://localhost:5000/api/dashboard";

function formatQuantity(value) {
  return Number(value).toLocaleString("en-NP", {
    maximumFractionDigits: 3,
  });
}

function formatMoney(value) {
  return Number(value).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const controllerRef = useRef(null);

  // Retrieve dashboard statistics from our Express API.
  const loadDashboard = useCallback(async () => {
    // Cancel an older request if one is still running.
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;

    setRefreshing(true);

    try {
      const response = await apiFetch(API, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to load dashboard");
      }

      const data = await response.json();

      if (!controller.signal.aborted) {
        setDashboard(data);
        setError("");
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message);
      }
    } finally {
      if (controllerRef.current === controller) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Load when the page opens, then refresh every 30 seconds.
  useEffect(() => {
    loadDashboard();

    const interval = setInterval(loadDashboard, 30000);

    return () => {
      clearInterval(interval);
      controllerRef.current?.abort();
    };
  }, [loadDashboard]);

  if (loading && !dashboard) {
    return <p>Loading dashboard...</p>;
  }

  if (!dashboard) {
    return (
      <section>
        <h1>Dashboard</h1>
        <p role="alert">{error || "No dashboard data"}</p>
        <button onClick={loadDashboard}>Try Again</button>
      </section>
    );
  }

  const { summary, alerts, recent_movements } = dashboard;

  const cardStyle = {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 16,
  };

  const metrics = [
    {
      label: "Active Ingredients",
      value: summary.active_ingredients,
    },
    {
      label: "Needs Attention",
      value: summary.low_stock_count,
    },
    {
      label: "Inventory Value",
      value: `NPR ${formatMoney(summary.inventory_value)}`,
    },
    {
      label: "Pending Kitchen Items",
      value: summary.pending_order_items,
    },
  ];

  return (
    <section style={{
      maxWidth: 1100,
      margin: "30px auto",
      padding: 20,
      fontFamily: "Arial, sans-serif",
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div>
          <h1>Restaurant Dashboard</h1>
          <p>Inventory overview and low-stock alerts</p>
        </div>

        <button
          onClick={loadDashboard}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && <p role="alert">{error}</p>}

      {/* Summary cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
        marginTop: 24,
      }}>
        {metrics.map((metric) => (
          <div key={metric.label} style={cardStyle}>
            <p>{metric.label}</p>

            <h2 style={{ marginBottom: 0 }}>
              {metric.value}
            </h2>
          </div>
        ))}
      </div>

      {/* Low-stock notifications */}
      <section style={{ marginTop: 32 }}>
        <h2>
          Stock Notifications ({summary.low_stock_count})
        </h2>

        {alerts.length === 0 ? (
          <p>All active ingredients have healthy stock.</p>
        ) : (
          <div style={{
            display: "grid",
            gap: 12,
          }}>
            {alerts.map((alert) => (
              <div
                key={alert.ingredient_id}
                style={{
                  ...cardStyle,
                  borderLeft: alert.level === "out_of_stock"
                    ? "4px solid #c0392b"
                    : "4px solid #d4a017",
                }}
              >
                <strong>{alert.name}</strong>

                <p>
                  Status:{" "}
                  {alert.level === "out_of_stock"
                    ? "Out of Stock"
                    : "Low Stock"}
                </p>

                <p>
                  Available:{" "}
                  {formatQuantity(alert.quantity_on_hand)}
                  {" "}{alert.unit}
                </p>

                <p>
                  Reorder Level:{" "}
                  {formatQuantity(alert.reorder_level)}
                  {" "}{alert.unit}
                </p>

                {alert.shortage_to_threshold !== null && (
                  <p>
                    Below Threshold By:{" "}
                    {formatQuantity(
                      alert.shortage_to_threshold
                    )}
                    {" "}{alert.unit}
                  </p>
                )}

                {alert.level === "out_of_stock" &&
                  Number(alert.reorder_level) === 0 && (
                    <p>
                      Set a reorder level for earlier warnings.
                    </p>
                  )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Inventory movement history */}
      <section style={{ marginTop: 32 }}>
        <h2>Recent Inventory Activity</h2>

        <div style={{ overflowX: "auto" }}>
          <table
            border="1"
            cellPadding="12"
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Movement</th>
                <th>Quantity Change</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {recent_movements.map((movement) => (
                <tr key={movement.id}>
                  <td>{movement.ingredient_name}</td>

                  <td>{movement.movement_type}</td>

                  <td>
                    {Number(movement.quantity_delta) > 0
                      ? "+"
                      : ""}
                    {formatQuantity(
                      movement.quantity_delta
                    )}
                    {" "}{movement.unit}
                  </td>

                  <td>
                    {new Date(
                      movement.created_at
                    ).toLocaleString()}
                  </td>
                </tr>
              ))}

              {recent_movements.length === 0 && (
                <tr>
                  <td colSpan="4">
                    No inventory activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p style={{
        marginTop: 20,
        color: "#666",
        fontSize: 12,
      }}>
        Last updated:{" "}
        {new Date(dashboard.generated_at).toLocaleString()}
        {" · "}Auto-refreshes every 30 seconds
      </p>
    </section>
  );
}

export default DashboardPage;


import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api.js";

function AuditLogsPage() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);

  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/users")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load employees");
        return res.json();
      })
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLogs() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
        });

        if (actorId) params.set("actor_id", actorId);
        if (action) params.set("action", action);

        const response = await apiFetch(
          `/api/audit-logs?${params}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Failed to load audit history");
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setLogs(data.rows);
          setTotal(data.total);
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

    loadLogs();

    return () => controller.abort();
  }, [actorId, action, page]);

  const totalPages = Math.max(
    1,
    Math.ceil(total / 20)
  );

  return (
    <section>
      <h1>Employee Activity Log</h1>
      <p>
        Review important inventory and administrative actions.
      </p>

      <div style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 20,
      }}>
        <label>
          Employee:
          <select
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All employees</option>

            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Action:
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All actions</option>

            {[
              "order_item.prepared",
              "purchase.received",
              "inventory.waste_recorded",
              "inventory.count_recorded",
              "user.created",
              "user.role_changed",
              "user.deactivated",
              "user.reactivated",
              "order.created",
              "purchase_order.created",
              "auth.password_changed",
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll(".", " / ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p role="alert">{error}</p>}
      {loading && <p>Loading activity...</p>}

      <div style={{ overflowX: "auto" }}>
        <table
          border="1"
          cellPadding="10"
          style={{ width: "100%" }}
        >
          <thead>
            <tr>
              <th>Time</th>
              <th>Employee</th>
              <th>Action</th>
              <th>Record</th>
              <th>Details</th>
            </tr>
          </thead>

          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>
                  {new Date(
                    log.created_at
                  ).toLocaleString()}
                </td>

                <td>
                  {log.actor_name}
                  {" "}
                  ({log.actor_role})
                </td>

                <td>{log.action}</td>

                <td>
                  {log.entity_type} #{log.entity_id}
                </td>

                <td>
                  <code>
                    {JSON.stringify(log.details)}
                  </code>
                </td>
              </tr>
            ))}

            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan="5">
                  No matching activity found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginTop: 20,
      }}>
        <button
          disabled={loading || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>

        <span>
          Page {page} of {totalPages}
        </span>

        <button
          disabled={loading || page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}

export default AuditLogsPage;


import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api.js";

const API = "http://localhost:5000/api";

function WasteAdjustmentsPage() {
  const [ingredients, setIngredients] = useState([]);
  const [events, setEvents] = useState([]);

  const [waste, setWaste] = useState({
    ingredient_id: "",
    quantity: "",
    reason: "spillage",
    note: "",
  });

  const [count, setCount] = useState({
    ingredient_id: "",
    quantity: "",
    reason: "routine_count",
    note: "",
  });

  const keys = useRef({ waste: null, count: null });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    const responses = await Promise.all([
      apiFetch(`${API}/ingredients?status=active`),
      apiFetch(`${API}/inventory-events`),
    ]);

    if (responses.some((response) => !response.ok)) {
      throw new Error("Failed to load inventory data");
    }

    const [stockData, eventData] = await Promise.all(
      responses.map((response) => response.json())
    );

    setIngredients(stockData);
    setEvents(eventData);
  }

  useEffect(() => {
    loadData().catch((err) => setError(err.message));
  }, []);

  function changeForm(type, field, value) {
    // Changing input means this is a different operation.
    keys.current[type] = null;

    const setter = type === "waste" ? setWaste : setCount;

    setter((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function submitEvent(event, type) {
    event.preventDefault();

    const form = type === "waste" ? waste : count;

    const ingredient = ingredients.find(
      (item) => String(item.id) === form.ingredient_id
    );

    if (!ingredient) {
      setError("Select an ingredient");
      return;
    }

    // Reuse this key if the same request is retried.
    if (!keys.current[type]) {
      keys.current[type] = crypto.randomUUID();
    }

    const payload = {
      ...form,
      ingredient_id: Number(form.ingredient_id),
      event_type: type,
      idempotency_key: keys.current[type],
    };

    if (type === "count") {
      payload.expected_quantity_on_hand =
        ingredient.quantity_on_hand;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        `${API}/inventory-events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to record inventory event"
        );
      }

      keys.current[type] = null;

      const setter = type === "waste" ? setWaste : setCount;

      setter((previous) => ({
        ...previous,
        quantity: "",
        note: "",
      }));

      setMessage(
        result.already_recorded
          ? "This event was already recorded."
          : `Inventory updated. Change: ${result.quantity_delta}`
      );

      try {
        await loadData();
      } catch {
        setError(
          "Event recorded, but the page could not refresh."
        );
      }

    } catch (err) {
      // Retain the key for retries after network errors.
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const selectedCountIngredient = ingredients.find(
    (item) => String(item.id) === count.ingredient_id
  );

  return (
    <section style={{ marginTop: 40 }}>
      <h1>Waste & Stock Adjustments</h1>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <h2>Record Waste</h2>

      <form onSubmit={(e) => submitEvent(e, "waste")}>
        <div>
          <label>Ingredient: </label>
          <select
            required
            value={waste.ingredient_id}
            onChange={(e) => changeForm(
              "waste", "ingredient_id", e.target.value
            )}
          >
            <option value="">Select ingredient</option>
            {ingredients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.quantity_on_hand} {item.unit})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Quantity wasted: </label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            required
            value={waste.quantity}
            onChange={(e) => changeForm(
              "waste", "quantity", e.target.value
            )}
          />
        </div>

        <div>
          <label>Reason: </label>
          <select
            value={waste.reason}
            onChange={(e) => changeForm(
              "waste", "reason", e.target.value
            )}
          >
            <option value="spillage">Spillage</option>
            <option value="expired">Expired</option>
            <option value="damaged">Damaged</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label>Notes: </label>
          <input
            value={waste.note}
            maxLength={500}
            onChange={(e) => changeForm(
              "waste", "note", e.target.value
            )}
          />
        </div>

        <button type="submit" disabled={busy}>
          Record Waste
        </button>
      </form>

      <hr />

      <h2>Physical Stock Count</h2>

      <form onSubmit={(e) => submitEvent(e, "count")}>
        <div>
          <label>Ingredient: </label>
          <select
            required
            value={count.ingredient_id}
            onChange={(e) => changeForm(
              "count", "ingredient_id", e.target.value
            )}
          >
            <option value="">Select ingredient</option>
            {ingredients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {selectedCountIngredient && (
          <p>
            System Quantity:{" "}
            {selectedCountIngredient.quantity_on_hand}{" "}
            {selectedCountIngredient.unit}
          </p>
        )}

        <div>
          <label>Physical Quantity: </label>
          <input
            type="number"
            min="0"
            step="0.001"
            required
            value={count.quantity}
            onChange={(e) => changeForm(
              "count", "quantity", e.target.value
            )}
          />
        </div>

        <div>
          <label>Count Reason: </label>
          <select
            value={count.reason}
            onChange={(e) => changeForm(
              "count", "reason", e.target.value
            )}
          >
            <option value="routine_count">Routine Count</option>
            <option value="full_count">Full Count</option>
            <option value="investigation">Investigation</option>
          </select>
        </div>

        <div>
          <label>Notes: </label>
          <input
            value={count.note}
            maxLength={500}
            onChange={(e) => changeForm(
              "count", "note", e.target.value
            )}
          />
        </div>

        <button type="submit" disabled={busy}>
          Save Physical Count
        </button>
      </form>

      <hr />

      <h2>Inventory Event History</h2>

      <button
        type="button"
        onClick={() => loadData().catch(
          (err) => setError(err.message)
        )}
      >
        Refresh
      </button>

      <table
        border="1"
        cellPadding="8"
        style={{ width: "100%", marginTop: 16 }}
      >
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Event</th>
            <th>Reason</th>
            <th>Change</th>
            <th>After</th>
          </tr>
        </thead>

        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{event.ingredient.name}</td>
              <td>{event.event_type}</td>
              <td>{event.reason}</td>
              <td>
                {event.quantity_delta}{" "}
                {event.ingredient.unit}
              </td>
              <td>
                {event.quantity_after}{" "}
                {event.ingredient.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default WasteAdjustmentsPage;

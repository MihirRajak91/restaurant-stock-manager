
import { useEffect, useState } from "react";

const API = "http://localhost:5000/api";

function KitchenPage() {
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [movements, setMovements] = useState([]);
  const [ingredients, setIngredients] = useState([]);

  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    const responses = await Promise.all([
      fetch(`${API}/menu-items`),
      fetch(`${API}/orders`),
      fetch(`${API}/stock-movements`),
      fetch(`${API}/ingredients?status=active`),
    ]);

    if (responses.some((response) => !response.ok)) {
      throw new Error("Failed to load kitchen data");
    }

    const [menu, tickets, history, stock] =
      await Promise.all(
        responses.map((response) => response.json())
      );

    setMenuItems(menu);
    setOrders(tickets);
    setMovements(history);
    setIngredients(stock);
  }

  useEffect(() => {
    loadData().catch((err) => setError(err.message));
  }, []);

  async function sendPost(path, body) {
    const response = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  async function createOrder(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await sendPost("/orders", {
        menu_item_id: Number(menuItemId),
        quantity: Number(quantity),
      });

      setMessage("Kitchen order created");
      setQuantity("1");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function markPrepared(itemId) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await sendPost(
        `/order-items/${itemId}/prepare`
      );

      setMessage(
        result.already_prepared
          ? "This item was already prepared"
          : "Item prepared and ingredients deducted"
      );

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 40 }}>
      <h1>Kitchen Orders</h1>

      <h2>Create Kitchen Ticket</h2>

      <form onSubmit={createOrder}>
        <select
          value={menuItemId}
          required
          onChange={(e) => setMenuItemId(e.target.value)}
        >
          <option value="">Select menu item</option>
          {menuItems
            .filter((item) => item.is_active)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - NPR {item.selling_price}
              </option>
            ))}
        </select>

        <label>
          Servings:
          <input
            type="number"
            min="1"
            max="20"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={busy}>
          Create Order
        </button>
      </form>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <h2>Kitchen Tickets</h2>

      {orders.length === 0 && <p>No orders yet.</p>}

      {orders.map((order) => (
        <div
          key={order.id}
          style={{
            border: "1px solid #ddd",
            padding: 16,
            marginBottom: 12,
          }}
        >
          <h3>Ticket #{order.id}</h3>

          {order.items.map((item) => (
            <div key={item.id}>
              <p>
                {item.quantity} × {item.menuItem.name}
              </p>

              <p>Status: {item.status}</p>

              {item.status === "pending" && (
                <button
                  disabled={busy}
                  onClick={() => markPrepared(item.id)}
                >
                  Mark Prepared
                </button>
              )}
            </div>
          ))}
        </div>
      ))}

      <h2>Current Ingredient Stock</h2>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Available</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((ingredient) => (
            <tr key={ingredient.id}>
              <td>{ingredient.name}</td>
              <td>
                {ingredient.quantity_on_hand}
                {" "}{ingredient.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Recent Inventory Movements</h2>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Type</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td>{movement.ingredient.name}</td>
              <td>{movement.movement_type}</td>
              <td>
                {movement.quantity_delta}
                {" "}{movement.ingredient.unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default KitchenPage;


import { useEffect, useState } from "react";

import { useAuth } from "../auth/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";

function KitchenPage() {
  const { user } = useAuth();

  const canCreate = ["admin", "manager"].includes(user.role);

  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadOrders() {
    const response = await apiFetch("/api/orders");

    if (!response.ok) {
      throw new Error("Failed to load kitchen orders");
    }

    setOrders(await response.json());
  }

  useEffect(() => {
    async function loadPage() {
      try {
        await loadOrders();

        // Kitchen Staff shouldn't fetch protected
        // menu-management data.
        if (canCreate) {
          const response = await apiFetch("/api/menu-items");

          if (!response.ok) {
            throw new Error("Failed to load menu items");
          }

          setMenuItems(await response.json());
        }
      } catch (err) {
        setError(err.message);
      }
    }

    loadPage();
  }, [canCreate]);

  async function sendPost(path, data) {
    const response = await apiFetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data ?? {}),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Request failed");
    }

    return result;
  }

  async function createOrder(event) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await sendPost("/api/orders", {
        menu_item_id: Number(menuItemId),
        quantity: Number(quantity),
      });

      setMessage("Kitchen order created");
      await loadOrders();
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
        `/api/order-items/${itemId}/prepare`
      );

      setMessage(
        result.already_prepared
          ? "This order item was already prepared"
          : "Prepared successfully. Stock deducted."
      );

      await loadOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Kitchen Orders</h1>

      {canCreate && (
        <form onSubmit={createOrder}>
          <h2>Create Kitchen Order</h2>

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
                  {item.name}
                </option>
              ))}
          </select>

          <input
            type="number"
            min="1"
            max="20"
            value={quantity}
            required
            onChange={(e) => setQuantity(e.target.value)}
          />

          <button disabled={busy}>Create Order</button>
        </form>
      )}

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <h2>Kitchen Tickets</h2>

      <button
        type="button"
        onClick={() => loadOrders().catch(
          (err) => setError(err.message)
        )}
      >
        Refresh Tickets
      </button>

      {orders.map((order) => (
        <article
          key={order.id}
          style={{
            border: "1px solid #ddd",
            padding: 16,
            marginTop: 12,
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
        </article>
      ))}
    </section>
  );
}

export default KitchenPage;

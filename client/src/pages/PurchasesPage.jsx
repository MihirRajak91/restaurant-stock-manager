
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api.js";

const API = "http://localhost:5000/api";

function PurchasesPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [orders, setOrders] = useState([]);

  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");

  const [purchase, setPurchase] = useState({
    supplier_id: "",
    ingredient_id: "",
    purchase_unit: "",
    quantity_ordered: "",
    unit_price: "",
  });

  const [receiptQuantities, setReceiptQuantities] = useState({});
  const receiptKeys = useRef({});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Retrieve suppliers, ingredients, and purchase orders.
  async function loadData() {
    const responses = await Promise.all([
      apiFetch(`${API}/purchases/suppliers`),
      apiFetch(`${API}/ingredients?status=active`),
      apiFetch(`${API}/purchases/orders`),
    ]);

    if (responses.some((response) => !response.ok)) {
      throw new Error("Could not load purchasing data");
    }

    const [suppliersData, ingredientsData, ordersData] =
      await Promise.all(
        responses.map((response) => response.json())
      );

    setSuppliers(suppliersData);
    setIngredients(ingredientsData);
    setOrders(ordersData);
  }

  useEffect(() => {
    loadData().catch((err) => setError(err.message));
  }, []);

  // Reusable POST helper.
  async function post(path, body) {
    const response = await apiFetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  async function createSupplier(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await post("/purchases/suppliers", {
        name: supplierName,
        phone: supplierPhone,
      });

      setSupplierName("");
      setSupplierPhone("");
      setMessage("Supplier created successfully");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createPurchaseOrder(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await post("/purchases/orders", {
        ...purchase,
        supplier_id: Number(purchase.supplier_id),
        ingredient_id: Number(purchase.ingredient_id),
      });

      setPurchase({
        supplier_id: "",
        ingredient_id: "",
        purchase_unit: "",
        quantity_ordered: "",
        unit_price: "",
      });

      setMessage("Purchase order created. Stock unchanged.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function receiveStock(itemId) {
    const quantity = receiptQuantities[itemId];

    if (!quantity) {
      setError("Enter the received quantity");
      return;
    }

    // Reuse the same key if this action is retried.
    if (!receiptKeys.current[itemId]) {
      receiptKeys.current[itemId] = crypto.randomUUID();
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await post(
        `/purchases/items/${itemId}/receive`,
        {
          quantity_received: quantity,
          idempotency_key: receiptKeys.current[itemId],
        }
      );

      // Successful receipt: next delivery gets a new key.
      delete receiptKeys.current[itemId];

      setReceiptQuantities((previous) => ({
        ...previous,
        [itemId]: "",
      }));

      setMessage(
        result.already_received
          ? "Delivery was already recorded; no duplicate stock added."
          : `${result.base_quantity} ${result.base_unit} of ` +
            `${result.ingredient} added to stock.`
      );

      try {
        await loadData();
      } catch (refreshError) {
        setError(
          "Stock was received successfully, but the page could not refresh."
        );
      }
    } catch (err) {
      // Keep the key so a retry won't double-receive.
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const selectedIngredient = ingredients.find(
    (ingredient) =>
      String(ingredient.id) === purchase.ingredient_id
  );

  const purchaseUnits = selectedIngredient?.unit === "ml"
    ? ["l", "ml"]
    : selectedIngredient?.unit === "g"
      ? ["kg", "g"]
      : selectedIngredient?.unit === "pcs"
        ? ["pcs"]
        : [];

  return (
    <section style={{ marginTop: 40 }}>
      <h1>Purchasing & Restocking</h1>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <h2>Add Supplier</h2>

      <form onSubmit={createSupplier}>
        <input
          placeholder="Supplier name"
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          maxLength={100}
          required
        />

        <input
          placeholder="Phone (optional)"
          value={supplierPhone}
          onChange={(e) => setSupplierPhone(e.target.value)}
          maxLength={30}
        />

        <button disabled={busy}>Save Supplier</button>
      </form>

      <h3>Suppliers</h3>
      <ul>
        {suppliers.map((supplier) => (
          <li key={supplier.id}>
            {supplier.name}
            {supplier.phone ? ` — ${supplier.phone}` : ""}
          </li>
        ))}
      </ul>

      <hr />

      <h2>Create Purchase Order</h2>

      <form onSubmit={createPurchaseOrder}>
        <div>
          <label>Supplier: </label>
          <select
            value={purchase.supplier_id}
            required
            onChange={(e) => setPurchase({
              ...purchase,
              supplier_id: e.target.value,
            })}
          >
            <option value="">Select supplier</option>
            {suppliers.filter((s) => s.is_active).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Ingredient: </label>
          <select
            value={purchase.ingredient_id}
            required
            onChange={(e) => setPurchase({
              ...purchase,
              ingredient_id: e.target.value,
              purchase_unit: "",
            })}
          >
            <option value="">Select ingredient</option>
            {ingredients.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.id}>
                {ingredient.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Purchase unit: </label>
          <select
            value={purchase.purchase_unit}
            required
            onChange={(e) => setPurchase({
              ...purchase,
              purchase_unit: e.target.value,
            })}
          >
            <option value="">Select unit</option>
            {purchaseUnits.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Quantity to order: </label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={purchase.quantity_ordered}
            required
            onChange={(e) => setPurchase({
              ...purchase,
              quantity_ordered: e.target.value,
            })}
          />
        </div>

        <div>
          <label>Price per purchase unit (NPR): </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={purchase.unit_price}
            required
            onChange={(e) => setPurchase({
              ...purchase,
              unit_price: e.target.value,
            })}
          />
        </div>

        <button disabled={busy}>Create Purchase Order</button>
      </form>

      <hr />

      <h2>Purchase Orders & Receiving</h2>

      {orders.length === 0 && <p>No purchase orders yet.</p>}

      {orders.map((order) => (
        <article
          key={order.id}
          style={{
            border: "1px solid #ddd",
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h3>Purchase Order #{order.id}</h3>
          <p>Supplier: {order.supplier.name}</p>

          {order.items.map((item) => {
            const remaining =
              Number(item.quantity_ordered) -
              Number(item.quantity_received);

            const status = remaining <= 0
              ? "Received"
              : Number(item.quantity_received) > 0
                ? "Partially Received"
                : "Pending";

            return (
              <div key={item.id}>
                <h4>{item.ingredient.name}</h4>

                <p>
                  Ordered: {item.quantity_ordered}
                  {" "}{item.purchase_unit}
                </p>

                <p>
                  Received: {item.quantity_received}
                  {" "}{item.purchase_unit}
                </p>

                <p>
                  Outstanding: {remaining.toFixed(3)}
                  {" "}{item.purchase_unit}
                </p>

                <p>
                  Unit Price: NPR {item.unit_price}
                </p>

                <p>Status: {status}</p>

                {remaining > 0 && (
                  <div>
                    <input
                      type="number"
                      min="0.001"
                      max={remaining}
                      step="0.001"
                      placeholder="Received quantity"
                      value={receiptQuantities[item.id] ?? ""}
                      onChange={(e) => {
                        delete receiptKeys.current[item.id];

                        setReceiptQuantities((previous) => ({
                          ...previous,
                          [item.id]: e.target.value,
                        }));
                      }}
                    />

                    <button
                      disabled={busy}
                      onClick={() => receiveStock(item.id)}
                    >
                      Receive Stock
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </article>
      ))}
    </section>
  );
}

export default PurchasesPage;

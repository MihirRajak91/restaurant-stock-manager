
import { useEffect, useState } from "react";

const API = "http://localhost:5000/api/ingredients";

const emptyForm = {
  name: "",
  unit: "ml",
  quantity_on_hand: "0",
  reorder_level: "0",
  cost_per_unit: "0",
};

function IngredientsPage() {
  const [ingredients, setIngredients] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Re-fetch ingredients whenever search, filter,
  // or refreshKey changes.
  useEffect(() => {
    const controller = new AbortController();

    async function loadIngredients() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          search,
          status,
        });

        const response = await fetch(
          `${API}?${params}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message);
        }

        if (!controller.signal.aborted) {
          setIngredients(data);
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

    loadIngredients();

    return () => controller.abort();
  }, [search, status, refreshKey]);

  // Shared helper for POST/PATCH requests.
  async function sendRequest(url, method, body) {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  // Tell React to reload the ingredient list.
  function refresh() {
    setRefreshKey((previous) => previous + 1);
  }

  // Create ingredient (from Lesson 4).
  async function handleCreate(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await sendRequest(API, "POST", form);

      setForm({ ...emptyForm });
      setSearch("");
      setStatus("active");
      setMessage("Ingredient created successfully");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Open the edit form.
  function startEdit(ingredient) {
    setEditing(ingredient.id);

    setEditForm({
      name: ingredient.name,
      reorder_level: ingredient.reorder_level,
      cost_per_unit: ingredient.cost_per_unit,
    });

    setError("");
    setMessage("");
  }

  // Save edited ingredient details.
  async function handleEdit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await sendRequest(
        `${API}/${editing}`,
        "PATCH",
        editForm
      );

      setEditing(null);
      setMessage("Ingredient updated successfully");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Archive or restore an ingredient.
  async function changeArchive(id, archive) {
    if (
      archive &&
      !window.confirm("Archive this ingredient?")
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const action = archive ? "archive" : "restore";

      await sendRequest(
        `${API}/${id}/${action}`,
        "PATCH"
      );

      setEditing(null);
      setMessage(
        archive ? "Ingredient archived" : "Ingredient restored"
      );

      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>

      <h2>Add Ingredient</h2>

      <form onSubmit={handleCreate}>
        <input
          placeholder="Ingredient name"
          value={form.name}
          maxLength={100}
          required
          onChange={(e) => setForm({
            ...form,
            name: e.target.value,
          })}
        />

        <select
          value={form.unit}
          onChange={(e) => setForm({
            ...form,
            unit: e.target.value,
          })}
        >
          <option value="ml">ml</option>
          <option value="g">g</option>
          <option value="pcs">pcs</option>
        </select>

        {[
          ["quantity_on_hand", "Opening Quantity"],
          ["reorder_level", "Reorder Level"],
          ["cost_per_unit", "Cost per Unit"],
        ].map(([key, label]) => (
          <div key={key}>
            <label>{label}: </label>
            <input
              type="number"
              min="0"
              step={key === "cost_per_unit" ? "0.0001" : "0.001"}
              value={form[key]}
              required
              onChange={(e) => setForm({
                ...form,
                [key]: e.target.value,
              })}
            />
          </div>
        ))}

        <button disabled={busy}>Add Ingredient</button>
      </form>

      <hr />

      <h2>Inventory</h2>

      <input
        placeholder="Search ingredients..."
        value={search}
        maxLength={100}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="active">Active</option>
        <option value="archived">Archived</option>
        <option value="all">All</option>
      </select>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      {loading ? (
        <p>Loading ingredients...</p>
      ) : (
        <table
          border="1"
          cellPadding="10"
          style={{ width: "100%", marginTop: 20 }}
        >
          <thead>
            <tr>
              <th>Name</th>
              <th>Stock</th>
              <th>Unit</th>
              <th>Cost / Unit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {ingredients.map((ingredient) => (
              <tr key={ingredient.id}>
                <td>{ingredient.name}</td>
                <td>{ingredient.quantity_on_hand}</td>
                <td>{ingredient.unit}</td>
                <td>{ingredient.cost_per_unit}</td>
                <td>
                  {ingredient.is_active
                    ? "Active"
                    : "Archived"}
                </td>
                <td>
                  {ingredient.is_active ? (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => startEdit(ingredient)}
                      >
                        Edit
                      </button>

                      <button
                        disabled={busy}
                        onClick={() =>
                          changeArchive(ingredient.id, true)
                        }
                      >
                        Archive
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() =>
                        changeArchive(ingredient.id, false)
                      }
                    >
                      Restore
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {ingredients.length === 0 && (
              <tr>
                <td colSpan="6">
                  No matching ingredients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {editing !== null && (
        <form onSubmit={handleEdit}>
          <h2>Edit Ingredient</h2>

          <label>Name: </label>
          <input
            value={editForm.name}
            required
            maxLength={100}
            onChange={(e) => setEditForm({
              ...editForm,
              name: e.target.value,
            })}
          />

          <label>Reorder Level: </label>
          <input
            type="number"
            min="0"
            step="0.001"
            required
            value={editForm.reorder_level}
            onChange={(e) => setEditForm({
              ...editForm,
              reorder_level: e.target.value,
            })}
          />

          <label>Cost per Unit: </label>
          <input
            type="number"
            min="0"
            step="0.0001"
            required
            value={editForm.cost_per_unit}
            onChange={(e) => setEditForm({
              ...editForm,
              cost_per_unit: e.target.value,
            })}
          />

          <button disabled={busy}>Save Changes</button>
          <button
            type="button"
            onClick={() => setEditing(null)}
          >
            Cancel
          </button>
        </form>
      )}

    </section>
  );
}

export default IngredientsPage;


import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000/api/ingredients";

const emptyForm = {
  name: "",
  unit: "ml",
  quantity_on_hand: "0",
  reorder_level: "0",
  cost_per_unit: "0",
};

function App() {
  const [ingredients, setIngredients] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load existing ingredients when the page opens.
  useEffect(() => {
    let active = true;

    async function loadIngredients() {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error("Failed to load ingredients");
        }

        const data = await response.json();

        if (active) {
          setIngredients(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadIngredients();

    return () => {
      active = false;
    };
  }, []);

  // Update a form field when the user types.
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // Submit the form to Express.
  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save");
      }

      setIngredients((previous) => [...previous, data]);
      setForm({ ...emptyForm });
      setMessage("Ingredient added successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{
      maxWidth: 900,
      margin: "40px auto",
      padding: 20,
      fontFamily: "Arial, sans-serif",
    }}>
      <h1>Restaurant Stock Manager</h1>

      <h2>Add Ingredient</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Ingredient Name</label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            maxLength={100}
            required
          />
        </div>

        <div>
          <label htmlFor="unit">Unit</label>
          <select
            id="unit"
            name="unit"
            value={form.unit}
            onChange={handleChange}
          >
            <option value="ml">Millilitres (ml)</option>
            <option value="g">Grams (g)</option>
            <option value="pcs">Pieces (pcs)</option>
          </select>
        </div>

        <div>
          <label htmlFor="quantity_on_hand">
            Opening Quantity
          </label>
          <input
            id="quantity_on_hand"
            name="quantity_on_hand"
            type="number"
            min="0"
            step={form.unit === "pcs" ? "1" : "0.001"}
            value={form.quantity_on_hand}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="reorder_level">
            Reorder Level
          </label>
          <input
            id="reorder_level"
            name="reorder_level"
            type="number"
            min="0"
            step="0.001"
            value={form.reorder_level}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="cost_per_unit">
            Cost per Base Unit (NPR)
          </label>
          <input
            id="cost_per_unit"
            name="cost_per_unit"
            type="number"
            min="0"
            step="0.0001"
            value={form.cost_per_unit}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Add Ingredient"}
        </button>
      </form>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <h2>Current Inventory</h2>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table border="1" cellPadding="12">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Cost / Unit</th>
            </tr>
          </thead>

          <tbody>
            {ingredients.map((ingredient) => (
              <tr key={ingredient.id}>
                <td>{ingredient.name}</td>
                <td>{ingredient.quantity_on_hand}</td>
                <td>{ingredient.unit}</td>
                <td>{ingredient.cost_per_unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

export default App;

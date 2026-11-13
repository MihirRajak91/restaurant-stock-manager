
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api.js";
import menuCategories from "../../../shared/menuCategories.json";

const API = "http://localhost:5000/api";

function RecipesPage() {
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState(menuCategories[0]);
  const [price, setPrice] = useState("");

  const [recipe, setRecipe] = useState([
    { ingredient_id: "", quantity: "" },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load active ingredients and existing recipes.
  async function loadData() {
    const [ingredientResponse, menuResponse] =
      await Promise.all([
        apiFetch(`${API}/ingredients?status=active`),
        apiFetch(`${API}/menu-items`),
      ]);

    if (!ingredientResponse.ok || !menuResponse.ok) {
      throw new Error("Failed to load recipe data");
    }

    const ingredientData = await ingredientResponse.json();
    const menuData = await menuResponse.json();

    setIngredients(ingredientData);
    setMenuItems(menuData);
  }

  useEffect(() => {
    loadData()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Add another ingredient to the recipe form.
  function addRecipeRow() {
    setRecipe((previous) => [
      ...previous,
      { ingredient_id: "", quantity: "" },
    ]);
  }

  // Update one particular ingredient row.
  function updateRecipeRow(index, field, value) {
    setRecipe((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, [field]: value }
          : row
      )
    );
  }

  // Remove an ingredient row.
  function removeRecipeRow(index) {
    setRecipe((previous) =>
      previous.filter((_, rowIndex) => rowIndex !== index)
    );
  }

  // Submit the new menu item and recipe.
  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      name,
      category,
      selling_price: price,
      recipe: recipe.map((row) => ({
        ingredient_id: Number(row.ingredient_id),
        quantity: row.quantity,
      })),
    };

    try {
      const response = await apiFetch(`${API}/menu-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save recipe");
      }

      setName("");
      setPrice("");
      setRecipe([{ ingredient_id: "", quantity: "" }]);

      setMessage("Recipe created successfully");

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading recipes...</p>;
  }

  return (
    <section style={{ marginTop: 40 }}>
      <h1>Recipe Management</h1>

      <h2>Create Menu Item</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Menu Item Name: </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </div>

        <div>
          <label htmlFor="menu-category">Category: </label>
          <select
            id="menu-category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            {menuCategories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Selling Price (NPR): </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <h3>Recipe Ingredients</h3>

        {recipe.map((row, index) => (
          <div key={index} style={{ marginBottom: 12 }}>
            <select
              value={row.ingredient_id}
              required
              onChange={(e) =>
                updateRecipeRow(
                  index,
                  "ingredient_id",
                  e.target.value
                )
              }
            >
              <option value="">Select ingredient</option>

              {ingredients.map((ingredient) => (
                <option
                  key={ingredient.id}
                  value={ingredient.id}
                >
                  {ingredient.name} ({ingredient.unit})
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0.001"
              step="0.001"
              placeholder="Quantity"
              value={row.quantity}
              required
              onChange={(e) =>
                updateRecipeRow(
                  index,
                  "quantity",
                  e.target.value
                )
              }
            />

            <button
              type="button"
              disabled={recipe.length === 1}
              onClick={() => removeRecipeRow(index)}
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          disabled={recipe.length >= 50}
          onClick={addRecipeRow}
        >
          + Add Ingredient
        </button>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Recipe"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => loadData().catch(
          (err) => setError(err.message)
        )}
      >
        Refresh Ingredients & Recipes
      </button>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <h2>Menu Items</h2>

      {menuItems.map((item) => (
        <article
          key={item.id}
          style={{
            border: "1px solid #ddd",
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h3>{item.name}</h3>
          <p>Category: {item.category}</p>
          <p>Selling Price: NPR {item.selling_price}</p>

          <h4>Ingredients</h4>

          <ul>
            {item.recipe.map((row) => (
              <li key={row.ingredient_id}>
                {row.ingredient_name}: {row.quantity} {row.unit}
                {" — "}NPR {row.line_cost}
              </li>
            ))}
          </ul>

          <p>Ingredient Cost: NPR {item.ingredient_cost}</p>
          <p>Gross Profit: NPR {item.gross_profit}</p>
          <p>
            Food Cost: {item.food_cost_percent ?? "N/A"}%
          </p>
        </article>
      ))}
    </section>
  );
}

export default RecipesPage;

import IngredientsPage from "./pages/IngredientsPage.jsx";
import RecipesPage from "./pages/RecipesPage.jsx";
import KitchenPage from "./pages/KitchenPage.jsx";
import PurchasesPage from "./pages/PurchasesPage.jsx";
import WasteAdjustmentsPage from "./pages/WasteAdjustmentsPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";

function App() {
  return (
    <main style={{
      maxWidth: 1000,
      margin: "40px auto",
      padding: 20,
      fontFamily: "Arial, sans-serif",
    }}>
      <h1>Restaurant Stock Manager</h1>
      <IngredientsPage />
      <RecipesPage />
      <KitchenPage />
      <PurchasesPage />
      <WasteAdjustmentsPage />
      <DashboardPage />
    </main>
  );
}

export default App;

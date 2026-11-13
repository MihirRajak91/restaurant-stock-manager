
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
  useNavigate,
} from "react-router";

import { useState } from "react";

import { useAuth } from "./auth/AuthContext.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";

import LoginPage from "./pages/LoginPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";

import DashboardPage from "./pages/DashboardPage.jsx";
import IngredientsPage from "./pages/IngredientsPage.jsx";
import RecipesPage from "./pages/RecipesPage.jsx";
import KitchenPage from "./pages/KitchenPage.jsx";
import PurchasesPage from "./pages/PurchasesPage.jsx";
import WasteAdjustmentsPage from "./pages/WasteAdjustmentsPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const links = [
    {
      path: "/dashboard",
      label: "Dashboard",
      roles: ["admin", "manager"],
    },
    {
      path: "/ingredients",
      label: "Ingredients",
      roles: ["admin", "manager"],
    },
    {
      path: "/recipes",
      label: "Recipes",
      roles: ["admin", "manager"],
    },
    {
      path: "/kitchen",
      label: "Kitchen",
      roles: ["admin", "manager", "kitchen"],
    },
    {
      path: "/purchases",
      label: "Purchases",
      roles: ["admin", "manager"],
    },
    {
      path: "/waste",
      label: "Waste & Adjustments",
      roles: ["admin", "manager"],
    },
    {
      path: "/reports",
      label: "Reports",
      roles: ["admin", "manager"],
    },
    {
      path: "/users",
      label: "Employees",
      roles: ["admin"],
    },
  ];

  async function handleLogout() {
    setError("");

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{
      maxWidth: 1200,
      margin: "0 auto",
      padding: 20,
      fontFamily: "Arial, sans-serif",
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
      }}>
        <h2>Restaurant Stock Manager</h2>

        <div>
          <span>
            {user.name} ({user.role})
          </span>

          <button
            onClick={handleLogout}
            style={{ marginLeft: 16 }}
          >
            Logout
          </button>
        </div>
      </header>

      {error && <p role="alert">{error}</p>}

      <nav style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        padding: "16px 0",
        borderBottom: "1px solid #ddd",
      }}>
        {links
          .filter((link) => link.roles.includes(user.role))
          .map((link) => (
            <NavLink key={link.path} to={link.path}>
              {link.label}
            </NavLink>
          ))}
      </nav>

      <main style={{ marginTop: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={<Navigate to="/dashboard" replace />}
          />

          <Route
            path="/kitchen"
            element={<KitchenPage />}
          />

          <Route
            element={
              <ProtectedRoute roles={["admin", "manager"]} />
            }
          >
            <Route
              path="/dashboard"
              element={<DashboardPage />}
            />
            <Route
              path="/ingredients"
              element={<IngredientsPage />}
            />
            <Route
              path="/recipes"
              element={<RecipesPage />}
            />
            <Route
              path="/purchases"
              element={<PurchasesPage />}
            />
            <Route
              path="/waste"
              element={<WasteAdjustmentsPage />}
            />
            <Route
              path="/reports"
              element={<ReportsPage />}
            />
          </Route>

          <Route
            element={<ProtectedRoute roles={["admin"]} />}
          >
            <Route
              path="/users"
              element={<UsersPage />}
            />
          </Route>
        </Route>
      </Route>

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

export default App;


import { useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { useAuth } from "../auth/AuthContext.jsx";

function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (user) {
    return (
      <Navigate
        to={user.role === "kitchen" ? "/kitchen" : "/dashboard"}
        replace
      />
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      const loggedInUser = await login(email, password);

      navigate(
        loggedInUser.role === "kitchen"
          ? "/kitchen"
          : "/dashboard",
        { replace: true }
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{
      maxWidth: 380,
      margin: "80px auto",
      padding: 24,
      border: "1px solid #ddd",
      borderRadius: 12,
      fontFamily: "Arial, sans-serif",
    }}>
      <h1>Restaurant Stock Manager</h1>
      <p>Sign in to your employee account.</p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}

export default LoginPage;

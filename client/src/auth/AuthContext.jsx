
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { apiFetch } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function handleSessionExpired() {
      setUser(null);
    }

    window.addEventListener(
      "rsm:session-expired",
      handleSessionExpired
    );

    return () => {
      window.removeEventListener(
        "rsm:session-expired",
        handleSessionExpired
      );
    };
  }, []);

  // Check for an existing valid session on page load.
  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await apiFetch("/api/auth/me");

        if (!response.ok) {
          if (active) setUser(null);
          return;
        }

        const data = await response.json();

        if (active) {
          setUser(data.user);
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, []);

  async function login(email, password) {
    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    setUser(data.user);
    return data.user;
  }

  async function logout() {
    const response = await apiFetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error("Logout failed");
    }

    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}

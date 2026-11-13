
import {
  Navigate,
  Outlet,
} from "react-router";

import { useAuth } from "./AuthContext.jsx";

function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Checking session...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <Navigate
        to={
          user.role === "kitchen"
            ? "/kitchen"
            : "/dashboard"
        }
        replace
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;

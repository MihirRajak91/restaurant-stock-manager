
import { useEffect, useState } from "react";

import { apiFetch } from "../lib/api.js";
import { useAuth } from "../auth/AuthContext.jsx";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "kitchen",
};

function UsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [roleDrafts, setRoleDrafts] = useState({});

  const [form, setForm] = useState({ ...emptyForm });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadUsers() {
    const response = await apiFetch("/api/users");

    if (!response.ok) {
      throw new Error("Failed to load employees");
    }

    const data = await response.json();

    setUsers(data);

    setRoleDrafts(
      Object.fromEntries(
        data.map((user) => [String(user.id), user.role])
      )
    );
  }

  useEffect(() => {
    loadUsers().catch((err) => setError(err.message));
  }, []);

  async function request(path, method, body) {
    const response = await apiFetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  async function createEmployee(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await request("/api/users", "POST", form);

      setForm({ ...emptyForm });
      setMessage("Employee account created");

      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveRole(target) {
    const role = roleDrafts[String(target.id)];

    if (role === target.role) return;

    if (!window.confirm(
      `Change ${target.name}'s role to ${role}?`
    )) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await request(
        `/api/users/${target.id}/role`,
        "PATCH",
        { role }
      );

      setMessage(
        "Role updated. Existing employee sessions were invalidated."
      );

      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(target) {
    const nextStatus = !target.is_active;

    const action = nextStatus
      ? "reactivate"
      : "deactivate";

    if (!window.confirm(
      `Are you sure you want to ${action} ${target.name}?`
    )) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await request(
        `/api/users/${target.id}/status`,
        "PATCH",
        { is_active: nextStatus }
      );

      setMessage(
        nextStatus
          ? "Employee reactivated"
          : "Employee deactivated"
      );

      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>Employee Management</h1>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <h2>Create Employee</h2>

      <form onSubmit={createEmployee}>
        <div>
          <label>Name: </label>
          <input
            required
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm({
              ...form,
              name: e.target.value,
            })}
          />
        </div>

        <div>
          <label>Email: </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({
              ...form,
              email: e.target.value,
            })}
          />
        </div>

        <div>
          <label>Initial Password: </label>
          <input
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({
              ...form,
              password: e.target.value,
            })}
          />
        </div>

        <div>
          <label>Role: </label>
          <select
            value={form.role}
            onChange={(e) => setForm({
              ...form,
              role: e.target.value,
            })}
          >
            <option value="kitchen">Kitchen Staff</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button type="submit" disabled={busy}>
          Create Employee
        </button>
      </form>

      <hr />

      <h2>Existing Employees</h2>

      <div style={{ overflowX: "auto" }}>
        <table
          border="1"
          cellPadding="10"
          style={{ width: "100%" }}
        >
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {users.map((employee) => {
              const isSelf =
                String(employee.id) === String(currentUser.id);

              const selectedRole =
                roleDrafts[String(employee.id)] ??
                employee.role;

              return (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{employee.email}</td>

                  <td>
                    <select
                      disabled={busy || isSelf}
                      value={selectedRole}
                      onChange={(e) => setRoleDrafts({
                        ...roleDrafts,
                        [String(employee.id)]: e.target.value,
                      })}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="kitchen">
                        Kitchen Staff
                      </option>
                    </select>
                  </td>

                  <td>
                    {employee.is_active
                      ? "Active"
                      : "Inactive"}
                  </td>

                  <td>
                    <button
                      disabled={
                        busy ||
                        isSelf ||
                        selectedRole === employee.role
                      }
                      onClick={() => saveRole(employee)}
                    >
                      Save Role
                    </button>

                    <button
                      disabled={busy || isSelf}
                      onClick={() => changeStatus(employee)}
                    >
                      {employee.is_active
                        ? "Deactivate"
                        : "Reactivate"}
                    </button>

                    {isSelf && <span> Current account</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default UsersPage;

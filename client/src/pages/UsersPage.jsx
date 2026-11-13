
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api.js";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "kitchen",
};

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadUsers() {
    const response = await apiFetch("/api/auth/users");

    if (!response.ok) {
      throw new Error("Failed to load employees");
    }

    setUsers(await response.json());
  }

  useEffect(() => {
    loadUsers().catch((err) => setError(err.message));
  }, []);

  async function createUser(event) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch("/api/auth/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to create employee"
        );
      }

      setForm({ ...emptyForm });
      setMessage("Employee account created successfully");

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

      <form onSubmit={createUser}>
        <h2>Create Employee</h2>

        <div>
          <label>Name: </label>
          <input
            value={form.name}
            required
            maxLength={100}
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
            value={form.email}
            required
            maxLength={254}
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
            value={form.password}
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
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

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <h2>Employees</h2>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>
                {user.is_active ? "Active" : "Disabled"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default UsersPage;

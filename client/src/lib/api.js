
const API_BASE = "http://localhost:5000";

export async function apiFetch(path, options = {}) {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path}`;

  return fetch(url, {
    ...options,
    credentials: "include",
  });
}

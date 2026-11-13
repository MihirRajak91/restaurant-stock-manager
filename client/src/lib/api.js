
const API_BASE = "http://localhost:5000";

export async function apiFetch(path, options = {}) {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
  });

  const isLoginRequest = new URL(
    url,
    API_BASE
  ).pathname === "/api/auth/login";

  if (response.status === 401 && !isLoginRequest) {
    window.dispatchEvent(
      new Event("rsm:session-expired")
    );
  }

  return response;
}

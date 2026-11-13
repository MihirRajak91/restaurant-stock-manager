import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { mock } from "node:test";
import sequelize from "../src/db.js";
import User from "../src/models/User.js";

// Use an isolated signing key without changing the application's environment file.
process.env.JWT_SECRET = randomBytes(32).toString("hex");

const { COOKIE_NAME, createSessionToken } = await import("../src/utils/session.js");
const modules = [
  "purchaseRoutes",
  "inventoryEventRoutes",
  "stockMovementRoutes",
  "dashboardRoutes",
  "reportRoutes",
];

function request(router, method, path, token) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url: path,
      headers: {},
      query: {},
      body: {},
      cookies: token ? { [COOKIE_NAME]: token } : {},
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); return this; },
      end() { resolve({ status: this.statusCode }); return this; },
    };
    router.handle(req, res, (error) => {
      if (error) reject(error);
      else resolve({ status: 404 });
    });
  });
}

test("management routers require an active admin or manager session", async (t) => {
  let currentUser;
  mock.method(User, "findByPk", async () => currentUser);
  mock.method(sequelize, "query", async () => {
    throw new Error("Authorization checks must not query business data");
  });
  t.after(async () => {
    mock.restoreAll();
    await sequelize.close();
  });

  for (const name of modules) {
    await t.test(name, async () => {
      const { default: router } = await import(`../src/routes/${name}.js`);
      const endpoints = router.stack.filter((layer) => layer.route);
      assert.ok(endpoints.length > 0, "Check real endpoints, not an empty router");

      const user = { id: 1, role: "kitchen", is_active: true, session_version: 0 };
      const token = createSessionToken(user);
      const denied = [
        { token: undefined, user: null, status: 401 },
        { token: "invalid-session", user: null, status: 401 },
        { token, user, status: 403 },
        { token, user: { ...user, role: "viewer" }, status: 403 },
        { token, user: { ...user, role: "admin", is_active: false }, status: 401 },
        { token, user: { ...user, role: "admin", session_version: 1 }, status: 401 },
      ];

      for (const scenario of denied) {
        currentUser = scenario.user;
        for (const { route } of endpoints) {
          const path = route.path.replace(/:[^/]+/g, "1");
          for (const method of Object.keys(route.methods)) {
            const response = await request(router, method, path, scenario.token);
            assert.equal(response.status, scenario.status, `${name}: ${method} ${path}`);
          }
        }
      }

      // A probe after all existing endpoints must pass the same router-wide guards.
      router.get("/__access_check__", (_req, res) => res.status(204).end());
      for (const role of ["admin", "manager"]) {
        currentUser = { ...user, role };
        const response = await request(
          router, "get", "/__access_check__", createSessionToken(currentUser)
        );
        assert.equal(response.status, 204, `${name}: ${role} must be allowed`);
      }
    });
  }

  await t.test("stock movements cannot bypass their guards through the order router", async () => {
    const { default: orderRoutes } = await import("../src/routes/orderRoutes.js");
    currentUser = { id: 1, role: "kitchen", is_active: true, session_version: 0 };
    const response = await request(
      orderRoutes, "get", "/stock-movements", createSessionToken(currentUser)
    );
    assert.equal(response.status, 404);
  });
});

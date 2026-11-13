import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import sequelize from "../src/db.js";
import Ingredient from "../src/models/Ingredient.js";
import InventoryEvent from "../src/models/InventoryEvent.js";
import StockMovement from "../src/models/StockMovement.js";
import AuditLog from "../src/models/AuditLog.js";
import { recordInventoryEvent } from "../src/services/recordInventoryEvent.js";

process.env.JWT_SECRET = randomBytes(32).toString("hex");
const { default: routes } = await import("../src/routes/inventoryEventRoutes.js");
const actor = { id: "7", name: "Test Manager", role: "manager" };

function input(event_type, quantity) {
  return {
    ingredient_id: "1",
    event_type,
    reason: event_type === "waste" ? "damaged" : "routine_count",
    quantity,
    expected_quantity_on_hand: "100.000",
    idempotency_key: randomUUID(),
  };
}

function mockDatabase(t) {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  const state = { events: [], movements: [], audits: [], updates: [] };
  const ingredient = {
    id: "1", name: "Rice", unit: "g", is_active: true,
    quantity_on_hand: "100.000", cost_per_unit: "0.2500",
    async update(values, options) {
      assert.equal(options.transaction, transaction);
      state.updates.push(values);
    },
  };
  t.mock.method(sequelize, "transaction", async (work) => {
    try {
      const result = await work(transaction);
      state.outcome = "committed";
      return result;
    } catch (error) {
      state.outcome = "rejected";
      throw error;
    }
  });
  t.mock.method(sequelize, "query", async () => {
    throw new Error("These checks must not access a live database");
  });
  t.mock.method(Ingredient, "findByPk", async () => ingredient);
  t.mock.method(InventoryEvent, "findOne", async () => state.existing ?? null);
  t.mock.method(InventoryEvent, "create", async (values, options) => {
    assert.equal(options.transaction, transaction);
    const event = InventoryEvent.build({ id: "12", ...values });
    state.events.push(event);
    return event;
  });
  t.mock.method(StockMovement, "create", async (values, options) => {
    assert.equal(options.transaction, transaction);
    state.movements.push(values);
  });
  t.mock.method(AuditLog, "create", async (values, options) => {
    assert.equal(options.transaction, transaction);
    state.audits.push(values);
    if (state.auditFailure) throw state.auditFailure;
  });
  return state;
}

test("inventory events and their audit logs share employee attribution and a transaction", async (t) => {
  t.after(() => sequelize.close());

  for (const [type, quantity, after, delta] of [
    ["waste", "2.5", "97.500", "-2.500"],
    ["count", "102", "102.000", "2.000"],
    ["count", "100", "100.000", "0.000"],
  ]) {
    await t.test(`${type}: quantity ${quantity}`, async (t) => {
      const state = mockDatabase(t);
      const data = input(type, quantity);
      let result;
      if (type === "waste") {
        // Exercise the real route to verify it forwards the authenticated employee.
        const handler = routes.stack.find((layer) => layer.route?.methods.post).route.stack[0].handle;
        const res = {
          status(code) { this.statusCode = code; return this; },
          json(body) { result = body; return this; },
        };
        await handler({ body: data, user: actor }, res);
        assert.equal(res.statusCode, 201);
      } else {
        result = await recordInventoryEvent(data, actor);
      }
      assert.equal(result.quantity_after, after);
      assert.equal(state.outcome, "committed");
      assert.equal(state.events[0].recorded_by_user_id, actor.id);
      assert.equal(state.movements.length, delta === "0.000" ? 0 : 1);
      assert.equal(state.updates.length, delta === "0.000" ? 0 : 1);
      assert.deepEqual(state.audits, [{
        actor_user_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        action: type === "waste" ? "inventory.waste_recorded" : "inventory.count_recorded",
        entity_type: "inventory_event",
        entity_id: "12",
        details: {
          ingredient_id: "1", ingredient_name: "Rice", reason: data.reason,
          quantity_before: "100.000", quantity_after: after, quantity_delta: delta, unit: "g",
        },
      }]);
    });
  }

  await t.test("an idempotent retry creates no additional audit or stock writes", async (t) => {
    const state = mockDatabase(t);
    const data = input("waste", "2.5");
    state.existing = InventoryEvent.build({
      id: "12", ...data, entered_quantity: "2.500", note: null,
      quantity_before: "100.000", quantity_after: "97.500", quantity_delta: "-2.500",
    });
    const result = await recordInventoryEvent(data, actor);
    assert.equal(result.already_recorded, true);
    for (const writes of [state.events, state.updates, state.movements, state.audits]) {
      assert.equal(writes.length, 0);
    }
  });

  await t.test("an audit failure rejects the business transaction", async (t) => {
    const state = mockDatabase(t);
    state.auditFailure = new Error("Audit write failed");
    await assert.rejects(
      recordInventoryEvent(input("waste", "2.5"), actor),
      (error) => error === state.auditFailure
    );
    assert.equal(state.outcome, "rejected");
  });
});

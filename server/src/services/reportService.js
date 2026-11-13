
import { QueryTypes, Transaction } from "sequelize";
import Decimal from "decimal.js";

import sequelize from "../db.js";
import Ingredient from "../models/Ingredient.js";
import MenuItem from "../models/MenuItem.js";
import { formatMenuItem } from "./recipeCosting.js";

function sumMoney(rows, field) {
  const total = rows.reduce(
    (sum, row) => sum.plus(row[field] ?? "0"),
    new Decimal(0)
  );

  return total.toFixed(2);
}

export async function getReportData(fromDate, toDate) {
  return sequelize.transaction(
    {
      isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ,
    },
    async (transaction) => {
      // Convert restaurant-local dates to timestamp boundaries.
      const [bounds] = await sequelize.query(
        `
        SELECT
          (
            CAST(:fromDate AS date)::timestamp
            AT TIME ZONE 'Asia/Kathmandu'
          ) AS start_at,

          (
            (CAST(:toDate AS date) + 1)::timestamp
            AT TIME ZONE 'Asia/Kathmandu'
          ) AS end_at
        `,
        {
          replacements: { fromDate, toDate },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      const replacements = {
        startAt: bounds.start_at.toISOString(),
        endAt: bounds.end_at.toISOString(),
      };

      // Helper for running SELECT queries in this transaction.
      const run = (sql) => sequelize.query(sql, {
        replacements,
        type: QueryTypes.SELECT,
        transaction,
      });

      // REPORT 1: Ingredient consumption
      const consumption = await run(`
        SELECT
          i.id AS ingredient_id,
          i.name AS ingredient_name,
          i.unit,

          SUM(-sm.quantity_delta) AS quantity_used,

          ROUND(
            SUM(-sm.quantity_delta * sm.unit_cost), 2
          ) AS ingredient_cost

        FROM stock_movements sm

        JOIN ingredients i
          ON i.id = sm.ingredient_id

        WHERE sm.movement_type = 'preparation'
          AND sm.created_at >= :startAt
          AND sm.created_at < :endAt

        GROUP BY i.id, i.name, i.unit

        ORDER BY ingredient_cost DESC, i.name
      `);

      // REPORT 2: Purchase costs of received goods
      const purchases = await run(`
        SELECT
          i.id AS ingredient_id,
          i.name AS ingredient_name,
          i.unit,

          SUM(pr.base_quantity) AS quantity_received,

          ROUND(
            SUM(pr.quantity_received * poi.unit_price), 2
          ) AS purchase_cost

        FROM purchase_receipts pr

        JOIN purchase_order_items poi
          ON poi.id = pr.purchase_order_item_id

        JOIN ingredients i
          ON i.id = poi.ingredient_id

        WHERE pr.received_at >= :startAt
          AND pr.received_at < :endAt

        GROUP BY i.id, i.name, i.unit

        ORDER BY purchase_cost DESC, i.name
      `);

      // REPORT 3: Waste costs, grouped by reason
      const waste = await run(`
        SELECT
          i.id AS ingredient_id,
          i.name AS ingredient_name,
          i.unit,
          ie.reason,

          SUM(-sm.quantity_delta) AS quantity_wasted,

          ROUND(
            SUM(-sm.quantity_delta * sm.unit_cost), 2
          ) AS waste_cost

        FROM stock_movements sm

        JOIN inventory_events ie
          ON ie.id = sm.inventory_event_id

        JOIN ingredients i
          ON i.id = sm.ingredient_id

        WHERE sm.movement_type = 'waste'
          AND sm.created_at >= :startAt
          AND sm.created_at < :endAt

        GROUP BY i.id, i.name, i.unit, ie.reason

        ORDER BY waste_cost DESC, i.name
      `);

      // REPORT 4: Historical prepared-item profitability
      const historicalProfitability = await run(`
        WITH preparation_costs AS (
          SELECT
            order_item_id,
            SUM(-quantity_delta * unit_cost) AS cost
          FROM stock_movements
          WHERE movement_type = 'preparation'
          GROUP BY order_item_id
        )

        SELECT
          mi.id AS menu_item_id,
          mi.name AS menu_item_name,

          SUM(oi.quantity) AS servings_prepared,

          ROUND(
            SUM(oi.quantity * oi.unit_price), 2
          ) AS prepared_value,

          ROUND(
            SUM(COALESCE(pc.cost, 0)), 2
          ) AS ingredient_cost,

          ROUND(
            SUM(oi.quantity * oi.unit_price)
            - SUM(COALESCE(pc.cost, 0)), 2
          ) AS gross_contribution,

          CASE
            WHEN SUM(oi.quantity * oi.unit_price) > 0
            THEN ROUND(
              SUM(COALESCE(pc.cost, 0))
              / SUM(oi.quantity * oi.unit_price) * 100,
              2
            )
            ELSE NULL
          END AS food_cost_percent

        FROM order_items oi

        JOIN menu_items mi
          ON mi.id = oi.menu_item_id

        LEFT JOIN preparation_costs pc
          ON pc.order_item_id = oi.id

        WHERE oi.status = 'prepared'
          AND oi.prepared_at >= :startAt
          AND oi.prepared_at < :endAt

        GROUP BY mi.id, mi.name

        ORDER BY prepared_value DESC, mi.name
      `);

      // REPORT 5: Current recipe estimates
      // Reuse the associations and costing service from Lesson 6.
      const menuItems = await MenuItem.findAll({
        where: { is_active: true },
        include: [{
          model: Ingredient,
          as: "ingredients",
          through: { attributes: ["quantity"] },
        }],
        order: [["name", "ASC"]],
        transaction,
      });

      const currentRecipeProfitability = menuItems.map((item) => {
        const estimate = formatMenuItem(item);

        return {
          menu_item_id: estimate.id,
          menu_item_name: estimate.name,
          selling_price: estimate.selling_price,
          ingredient_cost: estimate.ingredient_cost,
          gross_profit: estimate.gross_profit,
          food_cost_percent: estimate.food_cost_percent,
        };
      });

      return {
        period: {
          from: fromDate,
          to: toDate,
          timezone: "Asia/Kathmandu",
        },

        summary: {
          consumption_cost: sumMoney(
            consumption, "ingredient_cost"
          ),
          purchase_cost: sumMoney(
            purchases, "purchase_cost"
          ),
          waste_cost: sumMoney(
            waste, "waste_cost"
          ),
          prepared_value: sumMoney(
            historicalProfitability, "prepared_value"
          ),
          gross_contribution: sumMoney(
            historicalProfitability, "gross_contribution"
          ),
        },

        consumption,
        purchases,
        waste,
        historical_profitability: historicalProfitability,
        current_recipe_profitability: currentRecipeProfitability,
      };
    }
  );
}

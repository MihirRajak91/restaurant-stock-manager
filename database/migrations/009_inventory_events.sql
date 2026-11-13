
BEGIN;

CREATE TABLE inventory_events (
    id BIGSERIAL PRIMARY KEY,

    ingredient_id BIGINT NOT NULL
        REFERENCES ingredients(id) ON DELETE RESTRICT,

    event_type VARCHAR(20) NOT NULL
        CHECK (event_type IN ('waste', 'count')),

    reason VARCHAR(30) NOT NULL,

    -- Amount wasted OR actual quantity counted
    entered_quantity NUMERIC(12,3) NOT NULL
        CHECK (entered_quantity >= 0),

    quantity_before NUMERIC(12,3) NOT NULL
        CHECK (quantity_before >= 0),

    quantity_after NUMERIC(12,3) NOT NULL
        CHECK (quantity_after >= 0),

    quantity_delta NUMERIC(12,3) NOT NULL,

    unit_cost NUMERIC(12,4) NOT NULL
        CHECK (unit_cost >= 0),

    note TEXT,

    idempotency_key UUID NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_event_reason CHECK (
        (
            event_type = 'waste'
            AND reason IN (
                'spillage', 'expired', 'damaged', 'other'
            )
            AND entered_quantity > 0
            AND quantity_delta = -entered_quantity
        )
        OR
        (
            event_type = 'count'
            AND reason IN (
                'routine_count', 'full_count', 'investigation'
            )
            AND quantity_after = entered_quantity
        )
    ),

    CONSTRAINT valid_event_balance CHECK (
        quantity_after = quantity_before + quantity_delta
    )
);

ALTER TABLE stock_movements
ADD COLUMN inventory_event_id BIGINT
REFERENCES inventory_events(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX unique_inventory_event_movement
ON stock_movements(inventory_event_id)
WHERE inventory_event_id IS NOT NULL;

ALTER TABLE stock_movements
ADD CONSTRAINT valid_inventory_event_movement CHECK (
    (
        movement_type IN ('waste', 'adjustment')
        AND inventory_event_id IS NOT NULL
        AND (
            movement_type <> 'waste'
            OR quantity_delta < 0
        )
    )
    OR
    (
        movement_type NOT IN ('waste', 'adjustment')
        AND inventory_event_id IS NULL
    )
);

COMMIT;

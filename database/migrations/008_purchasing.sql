
-- 1. Suppliers
CREATE TABLE suppliers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Purchase order headers
CREATE TABLE purchase_orders (
    id BIGSERIAL PRIMARY KEY,
    supplier_id BIGINT NOT NULL
        REFERENCES suppliers(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Purchase order ingredient lines
CREATE TABLE purchase_order_items (
    id BIGSERIAL PRIMARY KEY,

    purchase_order_id BIGINT NOT NULL
        REFERENCES purchase_orders(id) ON DELETE RESTRICT,

    ingredient_id BIGINT NOT NULL
        REFERENCES ingredients(id) ON DELETE RESTRICT,

    purchase_unit VARCHAR(10) NOT NULL
        CHECK (purchase_unit IN ('l', 'ml', 'kg', 'g', 'pcs')),

    conversion_factor NUMERIC(12,3) NOT NULL
        CHECK (conversion_factor > 0),

    quantity_ordered NUMERIC(12,3) NOT NULL
        CHECK (quantity_ordered > 0),

    quantity_received NUMERIC(12,3) NOT NULL DEFAULT 0
        CHECK (
            quantity_received >= 0
            AND quantity_received <= quantity_ordered
        ),

    unit_price NUMERIC(12,2) NOT NULL
        CHECK (unit_price >= 0),

    UNIQUE (purchase_order_id, ingredient_id)
);

-- 4. Actual goods receipts
CREATE TABLE purchase_receipts (
    id BIGSERIAL PRIMARY KEY,

    purchase_order_item_id BIGINT NOT NULL
        REFERENCES purchase_order_items(id) ON DELETE RESTRICT,

    quantity_received NUMERIC(12,3) NOT NULL
        CHECK (quantity_received > 0),

    base_quantity NUMERIC(12,3) NOT NULL
        CHECK (base_quantity > 0),

    unit_cost_per_base NUMERIC(12,4) NOT NULL
        CHECK (unit_cost_per_base >= 0),

    idempotency_key UUID NOT NULL UNIQUE,

    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link the existing ledger to purchase receipts
ALTER TABLE stock_movements
ADD COLUMN purchase_receipt_id BIGINT
REFERENCES purchase_receipts(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX unique_purchase_movement
ON stock_movements (purchase_receipt_id)
WHERE purchase_receipt_id IS NOT NULL;

ALTER TABLE stock_movements
ADD CONSTRAINT valid_purchase_movement
CHECK (
    (
        movement_type = 'purchase'
        AND purchase_receipt_id IS NOT NULL
        AND quantity_delta > 0
    )
    OR
    (
        movement_type <> 'purchase'
        AND purchase_receipt_id IS NULL
    )
);

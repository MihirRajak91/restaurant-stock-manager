
BEGIN;

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,

    actor_user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    actor_name VARCHAR(100) NOT NULL,

    actor_role VARCHAR(20) NOT NULL,

    action VARCHAR(80) NOT NULL,

    entity_type VARCHAR(40) NOT NULL,

    entity_id BIGINT NOT NULL,

    details JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT audit_details_object
        CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX audit_logs_recent_idx
ON audit_logs (id DESC);

CREATE INDEX audit_logs_actor_idx
ON audit_logs (actor_user_id, id DESC);

-- Add employee attribution to existing operations.
-- Nullable because older records predate this lesson.

ALTER TABLE order_items
ADD COLUMN prepared_by_user_id BIGINT
REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE purchase_receipts
ADD COLUMN received_by_user_id BIGINT
REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE inventory_events
ADD COLUMN recorded_by_user_id BIGINT
REFERENCES users(id) ON DELETE RESTRICT;

COMMIT;


BEGIN;

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(254) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('admin', 'manager', 'kitchen')),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    session_version INTEGER NOT NULL DEFAULT 0
        CHECK (session_version >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_lower_unique
ON users (LOWER(email));

COMMIT;

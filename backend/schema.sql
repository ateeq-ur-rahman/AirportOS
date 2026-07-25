-- AirportOS reference PostgreSQL schema.
-- Note: tables are also auto-created at startup via SQLAlchemy metadata
-- (see app/database.py). This file is the canonical, reviewable reference
-- copy for DBAs / migrations tooling (Alembic) and matches it exactly.

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(64) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(128) NOT NULL,
    role            VARCHAR(32) NOT NULL DEFAULT 'operator',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disruption_logs (
    id              SERIAL PRIMARY KEY,
    disruption_id   VARCHAR(64) NOT NULL,
    type            VARCHAR(64) NOT NULL,
    severity        VARCHAR(16) NOT NULL,
    flight_ids      JSONB NOT NULL,
    detected_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    raw_payload     JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_disruption_logs_disruption_id ON disruption_logs (disruption_id);

CREATE TABLE IF NOT EXISTS recovery_plan_logs (
    id                              SERIAL PRIMARY KEY,
    disruption_id                   VARCHAR(64) NOT NULL,
    plan_id                         VARCHAR(64) NOT NULL,
    rank                            INTEGER NOT NULL,
    title                           VARCHAR(255) NOT NULL,
    confidence_score                FLOAT NOT NULL,
    estimated_time_saved_minutes    FLOAT NOT NULL,
    estimated_cost_usd              FLOAT NOT NULL,
    risk_level                      VARCHAR(16) NOT NULL,
    reasoning                       JSONB NOT NULL,
    actions                         JSONB NOT NULL,
    created_at                      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_recovery_plan_logs_disruption_id ON recovery_plan_logs (disruption_id);
CREATE INDEX IF NOT EXISTS ix_recovery_plan_logs_plan_id ON recovery_plan_logs (plan_id);

CREATE TABLE IF NOT EXISTS decision_logs (
    id                          SERIAL PRIMARY KEY,
    disruption_id               VARCHAR(64) NOT NULL,
    plan_id                     VARCHAR(64) NOT NULL,
    operator_username           VARCHAR(64) NOT NULL,
    decision                    VARCHAR(16) NOT NULL, -- approved | rejected | overridden
    notes                       VARCHAR(500) DEFAULT '',
    time_to_decision_seconds    FLOAT DEFAULT 0,
    resulting_state             JSONB DEFAULT '{}',
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_decision_logs_disruption_id ON decision_logs (disruption_id);

-- Live operational state (flights, gates, crew, in-flight disruptions) is
-- intentionally NOT persisted relationally in this MVP — it lives in the
-- backend's in-memory SimulatorState for sub-second access and is streamed
-- via WebSocket / Kafka topics. Only the durable decision/audit trail above
-- is persisted. See docs/ARCHITECTURE.md for the production AODB-backed
-- design (flights/gates/crew as first-class tables with CDC into Kafka).

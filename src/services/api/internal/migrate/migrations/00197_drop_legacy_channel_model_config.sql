-- +goose Up
UPDATE channels
   SET config_json = config_json - 'default_model'
 WHERE config_json ? 'default_model';

ALTER TABLE IF EXISTS channel_identities
    DROP COLUMN IF EXISTS preferred_model,
    DROP COLUMN IF EXISTS reasoning_mode,
    DROP COLUMN IF EXISTS heartbeat_enabled,
    DROP COLUMN IF EXISTS heartbeat_interval_minutes,
    DROP COLUMN IF EXISTS heartbeat_model;

ALTER TABLE IF EXISTS channel_identity_links
    DROP COLUMN IF EXISTS heartbeat_enabled,
    DROP COLUMN IF EXISTS heartbeat_interval_minutes,
    DROP COLUMN IF EXISTS heartbeat_model;

-- +goose Down
ALTER TABLE IF EXISTS channel_identities
    ADD COLUMN IF NOT EXISTS preferred_model TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS reasoning_mode TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS heartbeat_enabled INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS heartbeat_interval_minutes INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS heartbeat_model TEXT NOT NULL DEFAULT '';

ALTER TABLE IF EXISTS channel_identity_links
    ADD COLUMN IF NOT EXISTS heartbeat_enabled INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS heartbeat_interval_minutes INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS heartbeat_model TEXT NOT NULL DEFAULT '';

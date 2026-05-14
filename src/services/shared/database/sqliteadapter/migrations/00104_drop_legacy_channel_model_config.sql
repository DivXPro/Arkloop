-- +goose Up
UPDATE channels
   SET config_json = json_remove(COALESCE(config_json, '{}'), '$.default_model')
 WHERE json_type(COALESCE(config_json, '{}'), '$.default_model') IS NOT NULL;

ALTER TABLE channel_identities DROP COLUMN preferred_model;
ALTER TABLE channel_identities DROP COLUMN reasoning_mode;
ALTER TABLE channel_identities DROP COLUMN heartbeat_enabled;
ALTER TABLE channel_identities DROP COLUMN heartbeat_interval_minutes;
ALTER TABLE channel_identities DROP COLUMN heartbeat_model;

ALTER TABLE channel_identity_links DROP COLUMN heartbeat_enabled;
ALTER TABLE channel_identity_links DROP COLUMN heartbeat_interval_minutes;
ALTER TABLE channel_identity_links DROP COLUMN heartbeat_model;

-- +goose Down
ALTER TABLE channel_identities ADD COLUMN preferred_model TEXT NOT NULL DEFAULT '';
ALTER TABLE channel_identities ADD COLUMN reasoning_mode TEXT NOT NULL DEFAULT '';
ALTER TABLE channel_identities ADD COLUMN heartbeat_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE channel_identities ADD COLUMN heartbeat_interval_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE channel_identities ADD COLUMN heartbeat_model TEXT NOT NULL DEFAULT '';

ALTER TABLE channel_identity_links ADD COLUMN heartbeat_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE channel_identity_links ADD COLUMN heartbeat_interval_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE channel_identity_links ADD COLUMN heartbeat_model TEXT NOT NULL DEFAULT '';

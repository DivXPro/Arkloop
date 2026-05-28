-- +goose Up
-- +goose StatementBegin
CREATE TABLE replays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE replay_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    replay_id UUID NOT NULL REFERENCES replays(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT,
    content_json JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    sort_order INT NOT NULL
);

CREATE INDEX replay_messages_replay_id_idx ON replay_messages(replay_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS replay_messages;
DROP TABLE IF EXISTS replays;
-- +goose StatementEnd

-- +goose Up
UPDATE threads
   SET config_json = (config_json - 'default_model')
                  || jsonb_build_object('chat_model', config_json->>'default_model')
 WHERE config_json ? 'default_model';

UPDATE threads AS t
   SET config_json = jsonb_set(COALESCE(t.config_json, '{}'::jsonb), '{chat_model}', ch.config_json->'default_model')
  FROM channels AS ch, channel_group_threads AS cgt
 WHERE cgt.channel_id = ch.id
   AND cgt.thread_id = t.id
   AND NOT COALESCE(t.config_json, '{}'::jsonb) ? 'chat_model'
   AND ch.config_json ? 'default_model'
   AND ch.config_json->>'default_model' <> ''
   AND t.deleted_at IS NULL;

UPDATE threads AS t
   SET config_json = jsonb_set(COALESCE(t.config_json, '{}'::jsonb), '{chat_model}', ch.config_json->'default_model')
  FROM channels AS ch, channel_dm_threads AS cdt
 WHERE cdt.channel_id = ch.id
   AND cdt.thread_id = t.id
   AND NOT COALESCE(t.config_json, '{}'::jsonb) ? 'chat_model'
   AND ch.config_json ? 'default_model'
   AND ch.config_json->>'default_model' <> ''
   AND t.deleted_at IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'channel_identity_links'
           AND column_name = 'heartbeat_enabled'
    ) THEN
        UPDATE threads AS t
           SET config_json = COALESCE(t.config_json, '{}'::jsonb)
                          || jsonb_build_object(
                              'heartbeat_enabled', cil.heartbeat_enabled <> 0,
                              'heartbeat_interval_minutes',
                              CASE WHEN cil.heartbeat_interval_minutes > 0 THEN cil.heartbeat_interval_minutes ELSE 30 END
                          )
          FROM scheduled_triggers AS st
          JOIN channel_identity_links AS cil
            ON cil.channel_id = st.channel_id
           AND cil.channel_identity_id = st.channel_identity_id
         WHERE st.thread_id = t.id
           AND st.trigger_kind = 'heartbeat'
           AND st.thread_id IS NOT NULL
           AND NOT COALESCE(t.config_json, '{}'::jsonb) ? 'heartbeat_enabled'
           AND t.deleted_at IS NULL;

        UPDATE threads AS t
           SET config_json = COALESCE(t.config_json, '{}'::jsonb)
                          || jsonb_build_object('heartbeat_model', btrim(cil.heartbeat_model))
          FROM scheduled_triggers AS st
          JOIN channel_identity_links AS cil
            ON cil.channel_id = st.channel_id
           AND cil.channel_identity_id = st.channel_identity_id
         WHERE st.thread_id = t.id
           AND st.trigger_kind = 'heartbeat'
           AND st.thread_id IS NOT NULL
           AND btrim(cil.heartbeat_model) <> ''
           AND NOT COALESCE(t.config_json, '{}'::jsonb) ? 'heartbeat_model'
           AND t.deleted_at IS NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'channel_identities'
           AND column_name = 'heartbeat_enabled'
    ) THEN
        UPDATE threads AS t
           SET config_json = COALESCE(t.config_json, '{}'::jsonb)
                          || jsonb_build_object(
                              'heartbeat_enabled', ci.heartbeat_enabled <> 0,
                              'heartbeat_interval_minutes',
                              CASE WHEN ci.heartbeat_interval_minutes > 0 THEN ci.heartbeat_interval_minutes ELSE 30 END
                          )
          FROM scheduled_triggers AS st
          JOIN channel_identities AS ci
            ON ci.id = st.channel_identity_id
         WHERE st.thread_id = t.id
           AND st.trigger_kind = 'heartbeat'
           AND st.thread_id IS NOT NULL
           AND NOT COALESCE(t.config_json, '{}'::jsonb) ? 'heartbeat_enabled'
           AND t.deleted_at IS NULL;

        UPDATE threads AS t
           SET config_json = COALESCE(t.config_json, '{}'::jsonb)
                          || jsonb_build_object('heartbeat_model', btrim(ci.heartbeat_model))
          FROM scheduled_triggers AS st
          JOIN channel_identities AS ci
            ON ci.id = st.channel_identity_id
         WHERE st.thread_id = t.id
           AND st.trigger_kind = 'heartbeat'
           AND st.thread_id IS NOT NULL
           AND btrim(ci.heartbeat_model) <> ''
           AND NOT COALESCE(t.config_json, '{}'::jsonb) ? 'heartbeat_model'
           AND t.deleted_at IS NULL;
    END IF;
END $$;

ALTER TABLE scheduled_triggers
    ADD COLUMN IF NOT EXISTS resolve_model_at_runtime BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE scheduled_triggers AS st
   SET model = COALESCE(NULLIF(btrim(t.config_json->>'heartbeat_model'), ''), ''),
       resolve_model_at_runtime = COALESCE(NULLIF(btrim(t.config_json->>'heartbeat_model'), ''), '') = ''
  FROM threads AS t
 WHERE st.thread_id = t.id
   AND st.trigger_kind = 'heartbeat'
   AND st.thread_id IS NOT NULL;

-- +goose Down
UPDATE threads
   SET config_json = (config_json - 'chat_model')
                  || jsonb_build_object('default_model', config_json->>'chat_model')
 WHERE config_json ? 'chat_model';

ALTER TABLE scheduled_triggers
    DROP COLUMN IF EXISTS resolve_model_at_runtime;

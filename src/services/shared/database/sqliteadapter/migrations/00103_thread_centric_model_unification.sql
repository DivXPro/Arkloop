-- +goose Up
UPDATE threads
   SET config_json = json_remove(
       json_set(
           COALESCE(config_json, '{}'),
           '$.chat_model',
           json_extract(config_json, '$.default_model')
       ),
       '$.default_model'
   )
 WHERE json_type(config_json, '$.default_model') IS NOT NULL;

UPDATE threads
   SET config_json = json_set(
       COALESCE(config_json, '{}'),
       '$.chat_model',
       (
           SELECT json_extract(ch.config_json, '$.default_model')
             FROM channel_group_threads AS cgt
             JOIN channels AS ch
               ON ch.id = cgt.channel_id
            WHERE cgt.thread_id = threads.id
              AND json_type(ch.config_json, '$.default_model') IS NOT NULL
              AND COALESCE(json_extract(ch.config_json, '$.default_model'), '') <> ''
            LIMIT 1
       )
   )
 WHERE json_type(COALESCE(config_json, '{}'), '$.chat_model') IS NULL
   AND deleted_at IS NULL
   AND EXISTS (
       SELECT 1
         FROM channel_group_threads AS cgt
         JOIN channels AS ch
           ON ch.id = cgt.channel_id
        WHERE cgt.thread_id = threads.id
          AND json_type(ch.config_json, '$.default_model') IS NOT NULL
          AND COALESCE(json_extract(ch.config_json, '$.default_model'), '') <> ''
   );

UPDATE threads
   SET config_json = json_set(
       COALESCE(config_json, '{}'),
       '$.chat_model',
       (
           SELECT json_extract(ch.config_json, '$.default_model')
             FROM channel_dm_threads AS cdt
             JOIN channels AS ch
               ON ch.id = cdt.channel_id
            WHERE cdt.thread_id = threads.id
              AND json_type(ch.config_json, '$.default_model') IS NOT NULL
              AND COALESCE(json_extract(ch.config_json, '$.default_model'), '') <> ''
            LIMIT 1
       )
   )
 WHERE json_type(COALESCE(config_json, '{}'), '$.chat_model') IS NULL
   AND deleted_at IS NULL
   AND EXISTS (
       SELECT 1
         FROM channel_dm_threads AS cdt
         JOIN channels AS ch
           ON ch.id = cdt.channel_id
        WHERE cdt.thread_id = threads.id
          AND json_type(ch.config_json, '$.default_model') IS NOT NULL
          AND COALESCE(json_extract(ch.config_json, '$.default_model'), '') <> ''
   );

UPDATE threads
   SET config_json = json_set(
       COALESCE(config_json, '{}'),
       '$.heartbeat_enabled',
       json(CASE WHEN (
           SELECT cil.heartbeat_enabled
             FROM scheduled_triggers AS st
             JOIN channel_identity_links AS cil
               ON cil.channel_id = st.channel_id
              AND cil.channel_identity_id = st.channel_identity_id
            WHERE st.thread_id = threads.id
              AND st.trigger_kind = 'heartbeat'
            LIMIT 1
       ) <> 0 THEN 'true' ELSE 'false' END),
       '$.heartbeat_interval_minutes',
       COALESCE(NULLIF((
           SELECT cil.heartbeat_interval_minutes
             FROM scheduled_triggers AS st
             JOIN channel_identity_links AS cil
               ON cil.channel_id = st.channel_id
              AND cil.channel_identity_id = st.channel_identity_id
            WHERE st.thread_id = threads.id
              AND st.trigger_kind = 'heartbeat'
            LIMIT 1
       ), 0), 30)
   )
 WHERE json_type(COALESCE(config_json, '{}'), '$.heartbeat_enabled') IS NULL
   AND deleted_at IS NULL
   AND EXISTS (SELECT 1 FROM pragma_table_info('channel_identity_links') WHERE name = 'heartbeat_enabled')
   AND EXISTS (
       SELECT 1
         FROM scheduled_triggers AS st
         JOIN channel_identity_links AS cil
           ON cil.channel_id = st.channel_id
          AND cil.channel_identity_id = st.channel_identity_id
        WHERE st.thread_id = threads.id
          AND st.trigger_kind = 'heartbeat'
   );

UPDATE threads
   SET config_json = json_set(
       COALESCE(config_json, '{}'),
       '$.heartbeat_model',
       (
           SELECT TRIM(cil.heartbeat_model)
             FROM scheduled_triggers AS st
             JOIN channel_identity_links AS cil
               ON cil.channel_id = st.channel_id
              AND cil.channel_identity_id = st.channel_identity_id
            WHERE st.thread_id = threads.id
              AND st.trigger_kind = 'heartbeat'
              AND TRIM(cil.heartbeat_model) <> ''
            LIMIT 1
       )
   )
 WHERE json_type(COALESCE(config_json, '{}'), '$.heartbeat_model') IS NULL
   AND deleted_at IS NULL
   AND EXISTS (SELECT 1 FROM pragma_table_info('channel_identity_links') WHERE name = 'heartbeat_model')
   AND EXISTS (
       SELECT 1
         FROM scheduled_triggers AS st
         JOIN channel_identity_links AS cil
           ON cil.channel_id = st.channel_id
          AND cil.channel_identity_id = st.channel_identity_id
        WHERE st.thread_id = threads.id
          AND st.trigger_kind = 'heartbeat'
          AND TRIM(cil.heartbeat_model) <> ''
   );

UPDATE threads
   SET config_json = json_set(
       COALESCE(config_json, '{}'),
       '$.heartbeat_enabled',
       json(CASE WHEN (
           SELECT ci.heartbeat_enabled
             FROM scheduled_triggers AS st
             JOIN channel_identities AS ci
               ON ci.id = st.channel_identity_id
            WHERE st.thread_id = threads.id
              AND st.trigger_kind = 'heartbeat'
            LIMIT 1
       ) <> 0 THEN 'true' ELSE 'false' END),
       '$.heartbeat_interval_minutes',
       COALESCE(NULLIF((
           SELECT ci.heartbeat_interval_minutes
             FROM scheduled_triggers AS st
             JOIN channel_identities AS ci
               ON ci.id = st.channel_identity_id
            WHERE st.thread_id = threads.id
              AND st.trigger_kind = 'heartbeat'
            LIMIT 1
       ), 0), 30)
   )
 WHERE json_type(COALESCE(config_json, '{}'), '$.heartbeat_enabled') IS NULL
   AND deleted_at IS NULL
   AND EXISTS (SELECT 1 FROM pragma_table_info('channel_identities') WHERE name = 'heartbeat_enabled')
   AND EXISTS (
       SELECT 1
         FROM scheduled_triggers AS st
         JOIN channel_identities AS ci
           ON ci.id = st.channel_identity_id
        WHERE st.thread_id = threads.id
          AND st.trigger_kind = 'heartbeat'
   );

UPDATE threads
   SET config_json = json_set(
       COALESCE(config_json, '{}'),
       '$.heartbeat_model',
       (
           SELECT TRIM(ci.heartbeat_model)
             FROM scheduled_triggers AS st
             JOIN channel_identities AS ci
               ON ci.id = st.channel_identity_id
            WHERE st.thread_id = threads.id
              AND st.trigger_kind = 'heartbeat'
              AND TRIM(ci.heartbeat_model) <> ''
            LIMIT 1
       )
   )
 WHERE json_type(COALESCE(config_json, '{}'), '$.heartbeat_model') IS NULL
   AND deleted_at IS NULL
   AND EXISTS (SELECT 1 FROM pragma_table_info('channel_identities') WHERE name = 'heartbeat_model')
   AND EXISTS (
       SELECT 1
         FROM scheduled_triggers AS st
         JOIN channel_identities AS ci
           ON ci.id = st.channel_identity_id
        WHERE st.thread_id = threads.id
          AND st.trigger_kind = 'heartbeat'
          AND TRIM(ci.heartbeat_model) <> ''
   );

ALTER TABLE scheduled_triggers ADD COLUMN resolve_model_at_runtime INTEGER NOT NULL DEFAULT 0;

UPDATE scheduled_triggers
   SET model = COALESCE(NULLIF(TRIM((
           SELECT json_extract(t.config_json, '$.heartbeat_model')
             FROM threads AS t
            WHERE t.id = scheduled_triggers.thread_id
       )), ''), ''),
       resolve_model_at_runtime = CASE
           WHEN COALESCE(NULLIF(TRIM((
               SELECT json_extract(t.config_json, '$.heartbeat_model')
                 FROM threads AS t
                WHERE t.id = scheduled_triggers.thread_id
           )), ''), '') = '' THEN 1
           ELSE 0
       END
 WHERE trigger_kind = 'heartbeat'
   AND thread_id IS NOT NULL;

-- +goose Down
UPDATE threads
   SET config_json = json_remove(
       json_set(
           COALESCE(config_json, '{}'),
           '$.default_model',
           json_extract(config_json, '$.chat_model')
       ),
       '$.chat_model'
   )
 WHERE json_type(config_json, '$.chat_model') IS NOT NULL;

ALTER TABLE scheduled_triggers DROP COLUMN resolve_model_at_runtime;

REVOKE EXECUTE ON FUNCTION app_private.telegram_notification_recipient(uuid) FROM ai_strength_worker;
DROP FUNCTION IF EXISTS app_private.telegram_notification_recipient(uuid);

DROP TRIGGER IF EXISTS notification_outbox_touch_updated_at ON app.notification_outbox;
DROP TABLE IF EXISTS app.notification_outbox;

DROP TYPE IF EXISTS app.notification_delivery_status;
DROP TYPE IF EXISTS app.notification_event_type;

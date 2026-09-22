ALTER TABLE registrations ADD COLUMN admin_notification_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (admin_notification_status IN ('pending', 'sent', 'failed'));
ALTER TABLE registrations ADD COLUMN admin_notification_sent_at TEXT;
ALTER TABLE registrations ADD COLUMN admin_notification_request_id TEXT;
ALTER TABLE registrations ADD COLUMN admin_notification_error TEXT;
ALTER TABLE registrations ADD COLUMN admin_notification_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE kit_orders ADD COLUMN admin_notification_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (admin_notification_status IN ('pending', 'sent', 'failed'));
ALTER TABLE kit_orders ADD COLUMN admin_notification_sent_at TEXT;
ALTER TABLE kit_orders ADD COLUMN admin_notification_request_id TEXT;
ALTER TABLE kit_orders ADD COLUMN admin_notification_error TEXT;
ALTER TABLE kit_orders ADD COLUMN admin_notification_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE registrations ADD COLUMN confirmation_email_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (confirmation_email_status IN ('pending', 'sent', 'failed'));
ALTER TABLE registrations ADD COLUMN confirmation_email_sent_at TEXT;
ALTER TABLE registrations ADD COLUMN confirmation_email_request_id TEXT;
ALTER TABLE registrations ADD COLUMN confirmation_email_error TEXT;
ALTER TABLE registrations ADD COLUMN confirmation_email_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE kit_orders ADD COLUMN confirmation_email_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (confirmation_email_status IN ('pending', 'sent', 'failed'));
ALTER TABLE kit_orders ADD COLUMN confirmation_email_sent_at TEXT;
ALTER TABLE kit_orders ADD COLUMN confirmation_email_request_id TEXT;
ALTER TABLE kit_orders ADD COLUMN confirmation_email_error TEXT;
ALTER TABLE kit_orders ADD COLUMN confirmation_email_attempts INTEGER NOT NULL DEFAULT 0;

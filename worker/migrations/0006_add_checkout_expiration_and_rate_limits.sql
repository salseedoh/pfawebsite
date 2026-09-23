ALTER TABLE registrations ADD COLUMN checkout_expires_at TEXT;
ALTER TABLE kit_orders ADD COLUMN checkout_expires_at TEXT;

CREATE TABLE IF NOT EXISTS request_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  duration_minutes INTEGER,
  location TEXT NOT NULL,
  class_price_cents INTEGER NOT NULL DEFAULT 12500,
  class_with_kit_price_cents INTEGER NOT NULL DEFAULT 15000,
  max_students INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  private_access_token TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'english',
  kit_selected INTEGER NOT NULL DEFAULT 0,
  amount_cents INTEGER NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (payment_status IN ('awaiting_payment', 'paid', 'refunded', 'cancelled')),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  confirmation_email_status TEXT NOT NULL DEFAULT 'pending' CHECK (confirmation_email_status IN ('pending', 'sent', 'failed')),
  confirmation_email_sent_at TEXT,
  confirmation_email_request_id TEXT,
  confirmation_email_error TEXT,
  confirmation_email_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS registrations_class_id_idx ON registrations(class_id);
CREATE INDEX IF NOT EXISTS registrations_payment_status_idx ON registrations(payment_status);

CREATE TABLE IF NOT EXISTS kit_orders (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  pickup_zip TEXT,
  kit_subtotal_cents INTEGER NOT NULL DEFAULT 4000,
  tax_cents INTEGER NOT NULL DEFAULT 330,
  amount_cents INTEGER NOT NULL DEFAULT 4330,
  payment_status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (payment_status IN ('awaiting_payment', 'paid', 'refunded', 'cancelled')),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  confirmation_email_status TEXT NOT NULL DEFAULT 'pending' CHECK (confirmation_email_status IN ('pending', 'sent', 'failed')),
  confirmation_email_sent_at TEXT,
  confirmation_email_request_id TEXT,
  confirmation_email_error TEXT,
  confirmation_email_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS kit_orders_payment_status_idx ON kit_orders(payment_status);

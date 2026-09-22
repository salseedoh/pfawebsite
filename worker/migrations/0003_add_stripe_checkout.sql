-- These fields are intentionally nullable until Stripe Checkout is enabled.
ALTER TABLE registrations ADD COLUMN stripe_checkout_session_id TEXT;
ALTER TABLE registrations ADD COLUMN stripe_payment_intent_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS registrations_stripe_checkout_session_id_idx
  ON registrations(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS registrations_stripe_payment_intent_id_idx
  ON registrations(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE kit_orders ADD COLUMN pickup_zip TEXT;
ALTER TABLE kit_orders ADD COLUMN kit_subtotal_cents INTEGER NOT NULL DEFAULT 4000;
-- Existing pre-Stripe orders keep a zero tax amount. New kit-only orders will set this to 330 cents.
ALTER TABLE kit_orders ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kit_orders ADD COLUMN stripe_checkout_session_id TEXT;
ALTER TABLE kit_orders ADD COLUMN stripe_payment_intent_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS kit_orders_stripe_checkout_session_id_idx
  ON kit_orders(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS kit_orders_stripe_payment_intent_id_idx
  ON kit_orders(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Migration 019: Stripe subscriber linkage columns
-- Allows the Stripe webhook handler to map Stripe customers → subscriber rows.

ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_stripe_customer
  ON subscribers(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

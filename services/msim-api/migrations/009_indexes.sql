-- Additional composite indexes for common query patterns

-- Mine browser: filter by commodity + country + status
CREATE INDEX idx_mines_commodity_country ON historical_mines (commodity, country);
CREATE INDEX idx_mines_commodity_status ON historical_mines (commodity, status);

-- Subscriber lookup by Stripe IDs
CREATE INDEX idx_subscribers_stripe_customer ON subscribers (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_subscribers_stripe_sub ON subscribers (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Targets by due date for dashboard
CREATE INDEX idx_targets_due_date ON msim_targets (due_date)
  WHERE due_date IS NOT NULL AND target_status NOT IN ('completed', 'rejected');

-- Documents SAS expiry for cache invalidation
CREATE INDEX idx_documents_sas_expiry ON msim_documents (sas_expires_at)
  WHERE sas_expires_at IS NOT NULL;

-- AfriXplore Payments

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Recipient
  scout_id UUID REFERENCES scouts(id),
  subscriber_id UUID REFERENCES subscribers(id),

  -- Reference
  report_id UUID REFERENCES reports(id),
  cluster_id UUID REFERENCES anomaly_clusters(id),

  -- Payment details
  type payment_type NOT NULL,
  amount_usd NUMERIC(10,4) NOT NULL CHECK (amount_usd > 0),

  -- Provider
  provider payment_provider NOT NULL,
  provider_transaction_id TEXT,
  provider_reference TEXT,

  -- Mobile money target
  recipient_phone TEXT,
  recipient_account TEXT,

  -- Status
  status payment_status DEFAULT 'pending',
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_scout ON payments(scout_id);
CREATE INDEX idx_payments_subscriber ON payments(subscriber_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_type ON payments(type);
CREATE INDEX idx_payments_created ON payments(created_at DESC);
CREATE INDEX idx_payments_provider_txn ON payments(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;

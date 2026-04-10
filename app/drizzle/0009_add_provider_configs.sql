CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  api_key TEXT,
  base_url TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_model_configs (
  id TEXT PRIMARY KEY,
  feature_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  temperature INTEGER,
  max_tokens INTEGER,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

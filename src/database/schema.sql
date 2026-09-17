CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('url', 'markdown')),
  source_url TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT posts_url_required_for_url CHECK (
    source_type <> 'url'
    OR source_url IS NOT NULL
  ),
  CONSTRAINT posts_no_url_for_markdown CHECK (
    source_type <> 'markdown'
    OR source_url IS NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);

CREATE TABLE IF NOT EXISTS platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  max_length INTEGER NOT NULL CHECK (max_length > 0),
  tone TEXT NOT NULL,
  max_hashtags INTEGER NOT NULL CHECK (max_hashtags >= 0),
  adapter VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platforms_enabled ON platforms (enabled);

CREATE TABLE IF NOT EXISTS variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES platforms (id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'approved', 'rejected', 'published')
  ),
  rejection_reason TEXT,
  generation_provider VARCHAR(100),
  generation_model VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT variants_unique_for_post_platform UNIQUE (post_id, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_variants_status ON variants (status);

CREATE INDEX IF NOT EXISTS idx_variants_post_id ON variants (post_id);

CREATE INDEX IF NOT EXISTS idx_variants_platform_id ON variants (platform_id);

CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  variant_id uuid NOT NULL REFERENCES variants (id) ON DELETE RESTRICT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'success', 'failed')
  ),
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_schedules_variant_id ON schedules (variant_id);

CREATE INDEX IF NOT EXISTS idx_schedules_pending_time ON schedules (status, scheduled_at);

CREATE TABLE IF NOT EXISTS publish_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  schedule_id uuid NOT NULL REFERENCES schedules (id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  idempotency_key VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  external_post_id TEXT,
  response JSONB,
  error TEXT,
  CONSTRAINT publish_attempt_number_unique UNIQUE (schedule_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_publish_attempts_schedule_id ON publish_attempts (schedule_id);

CREATE INDEX IF NOT EXISTS idx_publish_attempts_status ON publish_attempts (status);

CREATE INDEX IF NOT EXISTS idx_publish_attempts_started_at ON publish_attempts (started_at DESC);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'processing', 'completed', 'failed')
  ),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_post_id ON generation_jobs (post_id);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs (status);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at ON generation_jobs (created_at DESC);

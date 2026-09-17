INSERT INTO
  platforms (
    code,
    name,
    max_length,
    tone,
    max_hashtags,
    adapter
  )
VALUES
  (
    'telegram',
    'Telegram',
    4096,
    'informative and conversational',
    5,
    'telegram'
  ),
  (
    'mock_x',
    'X',
    280,
    'concise and engaging',
    3,
    'mock_x'
  ),
  (
    'mock_linkedin',
    'LinkedIn',
    3000,
    'professional and informative',
    5,
    'mock_linkedin'
  )
ON CONFLICT (code) DO UPDATE
SET
  name = excluded.name,
  max_length = excluded.max_length,
  tone = excluded.tone,
  max_hashtags = excluded.max_hashtags,
  adapter = excluded.adapter,
  updated_at = now();

INSERT INTO
  posts (id, source_type, content)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'markdown',
    '# Why Idempotent Publishing Matters

Every social publishing system eventually retries a request. Networks time out, workers restart, and queues redeliver. Without idempotency, each retry becomes a duplicate post.

The fix is to give every logical publish a stable identity: one variant, one scheduled slot, one idempotency key. Before contacting a platform, check whether that key has already succeeded. If it has, return the stored result instead of posting again.

Durable scheduling completes the picture. The database, not the queue, is the source of truth for what still needs to publish. A worker that dies mid-batch can restart and resume from the database without ever double-posting.'
  )
ON CONFLICT (id) DO NOTHING;

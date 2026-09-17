# Social Media Studio — Design Document

> Canonical design for the FlyRank capstone. This document describes the **intended final system**, not merely what exists today. The current gaps between this design and the code are tracked in [`TASKS.md`](./TASKS.md) and sequenced in [`PLAN.md`](./PLAN.md). An implementation-status table is included at the end so this document stays honest.

---

## 1. Problem

Social Media Studio transforms one stored blog post into a multi-platform social media campaign.

A user submits a blog post either as a URL or as pasted Markdown. The system stores that post as the single source of truth, then generates one platform-specific variant for each configured platform.

Each platform has its own content constraints, including maximum length, tone, and hashtag count. The system validates every generated or edited variant against its platform's constraint profile. Invalid variants are rejected before they can enter the review workflow.

A person must review every variant. A variant starts as `DRAFT` and can be approved or rejected. Only an approved variant can be scheduled.

Approved variants can be assigned a publishing time slot. A worker processes due schedules and publishes through a common `SocialPublisher` interface. The application must not contain platform-specific publishing logic.

Publishing must be idempotent: retrying the same variant for the same scheduled slot must not create a duplicate post. Scheduled work must also survive worker restarts, and every publish attempt must be recorded in publish history.

The system is therefore primarily a reliable content publishing workflow rather than a collection of social-media API integrations.

### Hard parts (the graded core)

1. **Idempotency** — a retry after a timeout must not create a second post.
2. **Constraint profiles** — rules are enforced by code, not by hope.
3. **Durable scheduling** — a worker that dies mid-batch resumes without duplicates.
4. **The adapter seam** — the app does not know which platform it publishes to.

---

## 2. Scope and Non-Goals

### In scope

* URL and Markdown ingestion with a stored source of truth.
* Config-driven platform constraint profiles enforced by a validator.
* AI-assisted (or template) variant generation per platform.
* Human review workflow: draft / approved / rejected / published.
* Publisher adapter layer with one real free target and at least two mocks.
* Idempotent, durable scheduling and an auditable publish history.

### Explicit non-goals

* Real X publishing
* Real LinkedIn publishing
* Instagram publishing
* Image generation
* Analytics
* Engagement tracking

X and LinkedIn are represented by mock adapters. Telegram is the single real free publishing target that proves the adapter architecture end to end.

---

## 3. Platform Constraint Profiles

The system represents platform rules as configuration (rows in `platforms`) rather than hardcoding platform-specific conditions throughout the application.

Each platform has:

* maximum content length
* expected tone
* maximum hashtag count
* publisher adapter code
* an `enabled` flag

### Seeded profiles

#### Telegram

| Constraint       | Rule                           |
| ---------------- | ------------------------------ |
| code             | `telegram`                     |
| Maximum length   | 4096 characters                |
| Tone             | Conversational and informative |
| Maximum hashtags | 5                              |
| Adapter          | `TelegramPublisher`            |

#### X

| Constraint       | Rule                 |
| ---------------- | -------------------- |
| code             | `mock_x`             |
| Maximum length   | 280 characters       |
| Tone             | Concise and engaging |
| Maximum hashtags | 3                    |
| Adapter          | `MockXPublisher`     |

#### LinkedIn

| Constraint       | Rule                         |
| ---------------- | ---------------------------- |
| code             | `mock_linkedin`              |
| Maximum length   | 3000 characters              |
| Tone             | Professional and informative |
| Maximum hashtags | 5                            |
| Adapter          | `MockLinkedInPublisher`      |

Constraint values are application configuration and can be changed without modifying the validation architecture.

### Enforcement model

A single `VariantValidator` enforces every profile. It is used in three places:

1. **After generation** — a generated variant that breaks a rule is never persisted as a reviewable variant.
2. **Before an edit is persisted** — edited content is re-validated against the owning platform's profile.
3. **Before scheduling** — an optional final guard so a stored-but-invalid variant cannot slip through.

Mandatory, machine-checkable rules:

* `content` is non-empty after trimming.
* `content.length <= max_length`.
* `countHashtags(content) <= max_hashtags`, where a hashtag is `#` followed by one or more Unicode letters, digits, or underscores.

**Tone** is a soft constraint. It is enforced in two complementary ways:

* The generation prompt instructs the model to match the configured tone.
* Deterministic, per-platform *tone rules* may be added as a `tone_rules jsonb` column (e.g. banned phrases, required call-to-action) and evaluated by the validator.

Tone is additionally a human-review responsibility: the reviewer sees the target tone beside the content and can reject a mismatched variant. Any automated tone rule must be configuration, never a hardcoded platform condition in business logic.

Every validation failure throws an `AppError` with a code that **names the broken rule** (`EMPTY_VARIANT`, `VARIANT_TOO_LONG`, `TOO_MANY_HASHTAGS`, `TONE_RULE_VIOLATED`) so the API response is actionable and PROBE 2 can be evidenced.

---

## 4. Data Model

Relational, PostgreSQL. All timestamps are UTC. IDs are UUIDs (`gen_random_uuid()`).

### `posts`

Stores the original blog post.

```text
id
source_type        -- 'url' | 'markdown'
source_url         -- required iff source_type = 'url'
content            -- normalized Markdown; single source of truth
created_at
updated_at
```

`source_type` identifies whether the post came from a URL or pasted Markdown. The stored `content` is the single source of truth for variant generation — no generation path may re-fetch the source URL.

### `platforms`

Stores the configured publishing platforms and their constraint profiles.

```text
id
code               -- unique, e.g. telegram | mock_x | mock_linkedin
name
max_length
tone
max_hashtags
adapter            -- adapter code resolved by the registry
enabled            -- only enabled platforms are generated/scheduled
created_at
updated_at
```

### `variants`

Stores one platform-specific version of a post.

```text
id
post_id            -- FK -> posts (cascade delete)
platform_id        -- FK -> platforms (restrict delete)
content
status             -- 'draft' | 'approved' | 'rejected' | 'published'
rejection_reason
generation_provider
generation_model
created_at
updated_at
```

Relationships:

```text
posts     1 ──── N variants
platforms 1 ──── N variants
```

One post has at most one variant per platform, enforced by a unique constraint on:

```text
(post_id, platform_id)
```

### Variant lifecycle

```text
DRAFT
  ├── APPROVED ────→ PUBLISHED
  └── REJECTED
```

Rules:

* Only `APPROVED` variants can be scheduled. Any other status ⇒ `4xx` and no schedule is created.
* Content edits must be validated against the platform profile before they are persisted.
* Editing a `PUBLISHED` variant is not allowed.
* Regeneration is refused while any variant of the post is `APPROVED` or `PUBLISHED`.
* A successful publish transitions the variant to `PUBLISHED`.

### `schedules`

Represents a scheduled publishing slot.

```text
id
variant_id
scheduled_at
status             -- 'pending' | 'processing' | 'success' | 'failed'
idempotency_key    -- unique
attempt_count
locked_at          -- lease timestamp for crash recovery
last_error
created_at
updated_at
completed_at
```

A schedule belongs to one variant. The idempotency key uniquely identifies the logical publishing operation for a variant and slot:

```text
idempotencyKey = sha256(`${variantId}:${scheduledAt.toISOString()}`)
```

The database enforces uniqueness on `idempotency_key`. Re-posting the same variant to the same slot therefore cannot create a second logical schedule; it returns the existing one.

### Schedule lifecycle

```text
PENDING → PROCESSING → SUCCESS
                     └→ FAILED (retryable; returns to PENDING via recovery)
```

### `publish_attempts`

Stores the history of every attempt to publish a scheduled variant. This is the auditable publish history.

```text
id
schedule_id
attempt_number         -- unique per schedule
idempotency_key
status                 -- 'started' | 'success' | 'failed'
started_at
completed_at
external_post_id
response               -- jsonb; includes mock preview payloads
error_message
```

Example:

```text
Schedule #42

Attempt 1
FAILED
Telegram timeout

Attempt 2
SUCCESS
external_post_id = 12345
```

### `generation_jobs`

Tracks asynchronous variant generation separate from the BullMQ job.

```text
id
post_id
status                 -- 'queued' | 'processing' | 'completed' | 'failed'
attempts
error
started_at
completed_at
created_at
updated_at
```

---

## 5. Publishing Architecture

The application depends on one publishing abstraction. Business logic knows only this interface; it never imports a platform SDK or builds a platform-specific URL.

```ts
interface SocialPublisher {
  publish(input: PublisherInput): Promise<PublisherResult>;
}

interface PublisherInput {
  content: string;
  platformCode: string;
  variantId: string;
  scheduleId: string;
  idempotencyKey: string;
}

interface PublisherResult {
  success: boolean;
  externalPostId?: string;
  response?: unknown;
  error?: string;
}
```

> The design intent above is canonical. The current code names the input/result types `PublisherInput` / `PublisherResult` and already includes the extra identifiers; the `PublishInput` / `PublishResult` names in the original brief are equivalent. See `src/publishing/social-publisher.ts`.

Implementations:

```text
SocialPublisher
├── TelegramPublisher          (real free target)
├── MockXPublisher             (records what it would post)
└── MockLinkedInPublisher      (records what it would post)
```

An **adapter registry** maps a platform's `adapter` code (or `code`) to a factory. Swapping the configured adapter changes configuration only — no business-logic changes. Resolution failure is a clear `404`/`500`-class error, never silent.

### Real adapter — Telegram

Sends `content` to the configured `TELEGRAM_CHAT_ID` via the Bot API `sendMessage` method and maps `result.message_id` to `externalPostId`. Failures return `{ success: false, error }` rather than throwing across the seam.

### Mock adapters

Mock adapters do not contact external platforms. They:

* return a deterministic mock `externalPostId`,
* return a `response` payload that acts as a preview (`{ platform, simulated: true, preview }`),
* and that payload is persisted in `publish_attempts.response`, so "what would have been posted" is recorded **in the database** and retrievable from the publish-history endpoint.

---

## 6. Idempotency and Durable Scheduling

Publishing is identified by **variant + scheduled slot**, represented by a unique idempotency key.

### Guarantees

* A repeated schedule request for the same variant and slot returns the existing schedule; it does not create a second logical publish.
* A repeated publish for the same schedule returns the existing success; it does not call the adapter again.
* Concurrent workers cannot both publish the same schedule.

### Mechanics

1. **Unique schedule key.** `schedules.idempotency_key` is `UNIQUE`; an insert conflict yields the existing row.
2. **Atomic claim.** A worker claims a due schedule with a conditional update:

   ```sql
   UPDATE schedules
   SET status = 'processing', locked_at = now(), updated_at = now()
   WHERE id = $1 AND status = 'pending'
   RETURNING *;
   ```

   Only one worker can win. Zero rows returned means another worker owns it.
3. **Attempt record first.** Before calling the adapter, insert `publish_attempts` with `status = 'started'` and `attempt_number = COALESCE(max)+1`; the `(schedule_id, attempt_number)` unique constraint prevents duplicate attempt numbering.
4. **Short-circuit on prior success.** If the schedule already has a `success` attempt, mark the schedule `success` and skip the adapter.
5. **Finalize atomically.** On adapter success, mark the attempt `success`, the schedule `success`, and the variant `published` in one transaction.
6. **Lease-based recovery.** A worker that crashes leaves a schedule in `processing` with a stale `locked_at`. A recovery sweep re-queues `processing` rows whose lease is older than a timeout back to `pending`, and re-enqueues all due `pending` rows.

### Durability model

The **database is the source of truth for what must be published**. Redis/BullMQ is an acceleration layer, not the system of record. A periodic scheduler sweep queries due `pending` schedules and enqueues jobs idempotently. Therefore:

* Losing Redis does not lose scheduled work.
* Restarting a worker resumes from the database.
* The acceptance test is:

  ```text
  publish → worker failure → worker restart
          → exactly one successful published result
          → zero duplicate posts
  ```

---

## 7. API Surface

Canonical contract. Where the current implementation diverges, the divergence is called out and tracked in `TASKS.md`.

### Posts

#### Create a post

```http
POST /api/posts
```

Markdown:

```json
{ "sourceType": "markdown", "content": "..." }
```

URL:

```json
{ "sourceType": "url", "sourceUrl": "https://example.com/article" }
```

> **Divergence:** the current code accepts `url` and ignores `sourceUrl`. The design contract uses `sourceUrl`; the handler must accept it (and may keep `url` as an alias for compatibility).

#### Get a post

```http
GET /api/posts/:id
```

### Variant generation

#### Generate variants

```http
POST /api/posts/:id/generate
```

Reads only the stored post and enqueues generation. Returns `202`/`201` with the generation job.

#### Get generation job

```http
GET /api/generation/:id
```

#### List variants for a post

```http
GET /api/posts/:id/variants
```

### Variant review

#### Get variant

```http
GET /api/variants/:id
```

#### Edit variant

```http
PUT /api/variants/:id
```

```json
{ "content": "..." }
```

Edited content must pass platform validation before persistence.

> **Divergence:** the current code registers `PATCH` and does not validate the new content. Design canonical verb is `PUT` (support both if convenient); validation is mandatory.

#### Approve variant

```http
POST /api/variants/:id/approve
```

#### Reject variant

```http
POST /api/variants/:id/reject
```

```json
{ "reason": "..." }
```

### Scheduling

#### Schedule variant

```http
POST /api/variants/:id/schedule
```

```json
{ "scheduledAt": "2026-09-10T18:00:00Z" }
```

If the variant is not `APPROVED`, return `409` (a `4xx`) with an error message and create no schedule.

> **Divergence:** the current handler reads `scheduleTime`, only checks approval, and never creates a schedule. It must be completed to persist a `pending` schedule and enqueue the publish job.

#### Get schedule

```http
GET /api/schedules/:id
```

#### List schedules

```http
GET /api/schedules?status=pending&variantId=...
```

### Publish history

#### Get attempts

```http
GET /api/schedules/:id/attempts
```

Returns the complete publish history for the schedule, including the mock preview payload for mock adapters.

### Health

```http
GET /health
```

---

## 8. Main Application Flow

```text
POST /api/posts
        │
        ▼
Store source post (URL fetched once, normalized to Markdown)
        │
        ▼
POST /api/posts/:id/generate
        │
        ▼
Enqueue BullMQ generation job
        │
        ▼
Read stored post only
        │
        ▼
Generate platform variants (AI or templates)
        │
        ▼
Validate each variant against its profile
        │
        ├── invalid → reject with a rule-naming validation error
        │
        ▼
Upsert valid variants as DRAFT
        │
        ▼
Human reviews variant
        │
        ├── reject
        │
        └── approve
              │
              ▼
Create schedule (unique idempotency key = variant + slot)
              │
              ▼
Scheduler sweep / BullMQ delayed job
              │
              ▼
Worker atomically claims the due schedule
              │
              ▼
SocialPublisher
        ┌─────┼──────────┐
        ▼     ▼          ▼
     Telegram Mock X  Mock LinkedIn
              │
              ▼
Record publish attempt + update schedule/variant
              │
              ▼
Publish history (exactly one success per slot)
```

---

## 9. Infrastructure

Target Docker Compose topology:

```text
docker-compose
├── api        # Express + TypeScript
├── worker     # BullMQ generation + publishing workers, scheduler sweep
├── postgres   # PostgreSQL
└── redis      # BullMQ queue backend
```

The API and worker share PostgreSQL and Redis but have separate responsibilities:

* The **API** manages campaigns, variants, review, scheduling, and read APIs.
* The **worker** processes due generation and publishing jobs and runs recovery sweeps.

The README must make `docker compose up` plus a seed step the entire setup for a stranger.

---

## 10. Configuration

All configuration is environment-based (Twelve-Factor). Secrets live only in `.env`, which is git-ignored; `.env.example` ships placeholders for every variable.

| Variable             | Purpose                              |
| -------------------- | ------------------------------------ |
| `PORT`               | API port                             |
| `DATABASE_URL`       | PostgreSQL connection string         |
| `REDIS_HOST`         | Redis host for BullMQ                |
| `REDIS_PORT`         | Redis port                           |
| `REDIS_PASSWORD`     | Redis password                       |
| `LLM_API_BASE_URL`   | OpenAI-compatible AI base URL        |
| `LLM_API_KEY`        | AI API key                           |
| `LLM_MODEL`          | AI model name                        |
| `TELEGRAM_BOT_TOKEN` | Real adapter bot token               |
| `TELEGRAM_CHAT_ID`   | Real adapter target chat/channel     |

---

## 11. Implementation Status

Accurate as of the current branch (`feat/adapters-and-idempotent-publish`).

| Capability | Status | Notes |
| --- | --- | --- |
| Post ingestion (Markdown) | ✅ Done | Validation + storage |
| Post ingestion (URL) | ✅ Done | Fetch → Readability → Markdown |
| Platform constraint profiles (config) | ✅ Done | `platforms` table + seed |
| Variant generation (AI) | ✅ Done | OpenAI-compatible provider + BullMQ worker |
| Validation: length, hashtags | ✅ Done | `VariantValidator` |
| Validation: tone | ⚠️ Partial | Prompt only; no deterministic rule |
| Review: get/approve/reject | ⚠️ Partial | No status-transition guards |
| Review: edit re-validation | ❌ Missing | Edit persists unvalidated content |
| Publisher interface + 3 adapters | ✅ Done | Registry present |
| Mock preview persisted in DB | ⚠️ Partial | Only via `publish_attempts` once publishing exists |
| Schedule creation endpoint | ❌ Missing | Stub returns 409 only |
| Publishing worker + scheduler | ❌ Missing | Heart of the grade |
| Idempotent publish | ❌ Missing | Schema only |
| Publish history API | ❌ Missing | Schema only |
| Durable recovery / crash safety | ❌ Missing | No lease/recovery sweep |
| Full `docker compose up` (api+worker) | ❌ Missing | Only db + redis |
| `.env.example` complete | ❌ Missing | Only `DATABASE_URL` |
| Tests | ❌ Missing | `npm test` runs 0 tests |
| `EVIDENCE.md` / `BUILDLOG.md` | ❌ Missing | Required at submission |
| README accuracy | ⚠️ Stale | Describes an earlier state |

See [`TASKS.md`](./TASKS.md) for the actionable backlog and [`PLAN.md`](./PLAN.md) for the phased implementation plan.

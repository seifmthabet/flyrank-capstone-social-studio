# Social Media Studio — Design Document

## 1. Problem

Social Media Studio transforms one stored blog post into a multi-platform social media campaign.

A user submits a blog post either as a URL or pasted Markdown. The system stores that post as the single source of truth, then generates one platform-specific variant for each configured platform.

Each platform has its own content constraints, including maximum length, tone, and hashtag count. The system validates every generated or edited variant against its platform's constraint profile. Invalid variants are rejected before they can enter the review workflow.

A person must review every variant. A variant starts as `DRAFT` and can be approved or rejected. Only an approved variant can be scheduled.

Approved variants can be assigned a publishing time slot. A worker processes due schedules and publishes through a common `SocialPublisher` interface. The application must not contain platform-specific publishing logic.

Publishing must be idempotent: retrying the same variant for the same scheduled slot must not create a duplicate post. Scheduled work must also survive worker restarts, and every publish attempt must be recorded in publish history.

The system is therefore primarily a reliable content publishing workflow rather than a collection of social-media API integrations.

---

## 2. Platform Constraint Profiles

The system represents platform rules as configuration rather than hardcoding platform-specific conditions throughout the application.

Each platform has:

* maximum content length
* expected tone
* maximum hashtag count
* publisher adapter

### Telegram

| Constraint       | Rule                           |
| ---------------- | ------------------------------ |
| Maximum length   | 4096 characters                |
| Tone             | Conversational and informative |
| Maximum hashtags | 5                              |
| Adapter          | `TelegramPublisher`            |

### X

| Constraint       | Rule                 |
| ---------------- | -------------------- |
| Maximum length   | 280 characters       |
| Tone             | Concise and engaging |
| Maximum hashtags | 3                    |
| Adapter          | `MockXPublisher`     |

### LinkedIn

| Constraint       | Rule                         |
| ---------------- | ---------------------------- |
| Maximum length   | 3000 characters              |
| Tone             | Professional and informative |
| Maximum hashtags | 5                            |
| Adapter          | `MockLinkedInPublisher`      |

The constraint values are application configuration and can be changed without modifying the validation architecture.

The validator is responsible for enforcing the profile. A variant that violates a constraint must not be persisted as a reviewable variant.

---

## 3. Publishing Architecture

The application depends on one publishing abstraction:

```ts
interface SocialPublisher {
  publish(input: PublishInput): Promise<PublishResult>;
}
```

The application does not directly call Telegram, X, or LinkedIn APIs.

Implementations:

```text
SocialPublisher
├── TelegramPublisher
├── MockXPublisher
└── MockLinkedInPublisher
```

### Publish input

```ts
interface PublishInput {
  content: string;
  idempotencyKey: string;
}
```

### Publish result

```ts
interface PublishResult {
  success: boolean;
  externalPostId?: string;
  response?: unknown;
  error?: string;
}
```

The real Telegram adapter sends the content to the configured Telegram target.

The mock adapters do not contact external platforms. They record what would have been published and provide a preview, satisfying the adapter architecture without requiring real X or LinkedIn accounts.

Changing the configured adapter must not require changes to business logic.

---

## 4. Data Model

### `posts`

Stores the original blog post.

```text
id
source_type
source_url
content
created_at
updated_at
```

`source_type` identifies whether the post came from a URL or pasted Markdown.

The stored `content` is the single source of truth for variant generation.

---

### `platforms`

Stores the configured publishing platforms and their constraint profiles.

```text
id
code
name
max_length
tone
max_hashtags
adapter
created_at
```

Example platform records:

```text
telegram
mock_x
mock_linkedin
```

---

### `variants`

Stores one platform-specific version of a post.

```text
id
post_id
platform_id
content
status
created_at
updated_at
```

Relationships:

```text
posts 1 ──── N variants
platforms 1 ──── N variants
```

For the core implementation, one post has at most one variant per platform.

A database uniqueness constraint is therefore applied to:

```text
(post_id, platform_id)
```

---

### Variant statuses

The variant lifecycle is:

```text
DRAFT
  │
  ├── APPROVED ────→ PUBLISHED
  │
  └── REJECTED
```

Only `APPROVED` variants can be scheduled.

Content edits must be validated against the platform profile before they are persisted.

---

### `schedules`

Represents a scheduled publishing slot.

```text
id
variant_id
scheduled_at
status
idempotency_key
created_at
updated_at
```

A schedule belongs to one variant.

The idempotency key uniquely identifies the logical publishing operation for a variant and slot.

Conceptually:

```text
idempotencyKey =
  variantId + scheduledAt
```

The database enforces uniqueness on the idempotency key.

---

### Schedule statuses

```text
PENDING
PROCESSING
SUCCESS
FAILED
```

The exact retry behavior will be implemented by the worker/queue layer.

---

### `publish_attempts`

Stores the history of every attempt to publish a scheduled variant.

```text
id
schedule_id
attempt_number
idempotency_key
status
started_at
completed_at
external_post_id
response
error
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

This provides an auditable publishing history.

---

## 5. Idempotency

Publishing is identified by:

```text
variant + scheduled slot
```

and represented by a unique idempotency key.

The system must guarantee that a repeated scheduling/publishing operation for the same variant and slot cannot create a second logical publish.

The database provides uniqueness constraints for the logical schedule, while the worker coordinates publishing and publish-history state.

The implementation must specifically handle the failure case where a worker fails during publishing and is restarted.

The acceptance test is:

```text
publish
→ worker failure / retry
→ worker restart
→ exactly one successful published result
→ zero duplicate posts
```

Idempotency is a core reliability requirement of the system.

---

## 6. API Surface

### Posts

#### Create a post

```http
POST /api/posts
```

Accepts either:

```json
{
  "sourceType": "markdown",
  "content": "..."
}
```

or:

```json
{
  "sourceType": "url",
  "sourceUrl": "https://example.com/article"
}
```

#### Get a post

```http
GET /api/posts/:id
```

---

### Variant generation

#### Generate variants

```http
POST /api/posts/:id/generate
```

Reads only the stored post and generates platform-specific variants.

#### List variants for a post

```http
GET /api/posts/:id/variants
```

---

### Variant review

#### Get variant

```http
GET /api/variants/:id
```

#### Edit variant

```http
PUT /api/variants/:id
```

Edited content must pass platform validation.

#### Approve variant

```http
POST /api/variants/:id/approve
```

#### Reject variant

```http
POST /api/variants/:id/reject
```

---

### Scheduling

#### Schedule variant

```http
POST /api/variants/:id/schedule
```

Example:

```json
{
  "scheduledAt": "2026-09-10T18:00:00Z"
}
```

If the variant is not approved, the endpoint returns a `4xx` response and does not create a schedule.

#### Get schedule

```http
GET /api/schedules/:id
```

---

### Publish history

#### Get attempts

```http
GET /api/schedules/:id/attempts
```

Returns the complete publish history for the schedule.

---

## 7. Main Application Flow

```text
POST /api/posts
        │
        ▼
Store source post
        │
        ▼
POST /api/posts/:id/generate
        │
        ▼
Read stored post
        │
        ▼
Generate platform variants
        │
        ▼
Validate each variant
        │
        ├── invalid → reject with validation error
        │
        ▼
Store valid variants as DRAFT
        │
        ▼
Human reviews variant
        │
        ├── reject
        │
        └── approve
              │
              ▼
        Create schedule
              │
              ▼
        BullMQ job
              │
              ▼
        Worker processes job
              │
              ▼
        SocialPublisher
              │
        ┌─────┼──────────┐
        ▼     ▼          ▼
     Telegram Mock X  Mock LinkedIn
              │
              ▼
        Publish history
```

---

## 8. Infrastructure

The application will run using Docker Compose.

```text
docker-compose
├── api
│   └── Express + TypeScript
│
├── worker
│   └── BullMQ worker
│
├── postgres
│   └── PostgreSQL
│
└── redis
    └── BullMQ queue backend
```

The API and worker share PostgreSQL and Redis but have separate responsibilities.

The API manages campaigns, variants, review, and scheduling.

The worker processes due publishing jobs.

---

## 9. Explicit Non-Goals

The core system will **not** implement:

* real X publishing
* real LinkedIn publishing
* Instagram publishing
* image generation
* analytics
* engagement tracking

X and LinkedIn will be represented by mock adapters.

The system will use one real free publishing target, Telegram, to demonstrate the adapter architecture and real publishing flow.

These features are explicitly outside the core scope of the capstone.

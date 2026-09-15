CREATE EXTENSION IF NOT EXISTS pgcrypto;

create table posts (
    id uuid primary key default gen_random_uuid(),
    source_type varchar(20) not null check (source_type in ('url', 'markdown')),
    source_url text,
    content text not null,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),

    constraint posts_url_required_for_url check (
        source_type <> 'url' or source_url is not null
                                                ),
    constraint posts_no_url_for_markdown check (
        source_type <> 'markdown' or source_url is null
                                                )
);

create index idx_posts_created_at on posts (created_at desc);

create table platforms (
    id uuid primary key default gen_random_uuid(),
    code varchar(50) not null unique,
    name varchar(100) not null,
    max_length integer not null check (max_length > 0),
    tone text not null,
    max_hashtags integer not null check (max_hashtags > 0),
    adapter varchar(100) not null,
    enabled boolean not null default true,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create index idx_platforms_enabled on platforms (enabled);

create table variants (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references posts(id) on delete cascade,
    platform_id uuid not null references platforms(id) on delete restrict,
    content text not null,
    status varchar(20) not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'published')),
    rejection_reason text,
    generation_provider VARCHAR(100),
    generation_model VARCHAR(100),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),

    constraint variants_unique_for_post_platform unique (post_id, platform_id)
);

create index idx_variants_status on variants (status);
create index idx_variants_post_id on variants (post_id);
create index idx_variants_platform_id on variants (platform_id);

create table schedules (
    id uuid primary key default gen_random_uuid(),
    variant_id uuid not null references variants(id) on delete restrict,
    scheduled_at timestamp not null,
    status varchar(20) not null default 'pending' check (status in ('pending', 'processing','success', 'failed')),
    idempotency_key varchar(255) not null unique,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    completed_at timestamp
);

create index idx_schedules_variant_id on schedules (variant_id);
create index idx_schedules_pending_time on schedules (status, scheduled_at);

create table publish_attempts (
    id uuid primary key default gen_random_uuid(),
    schedule_id uuid not null references schedules(id) on delete cascade,
    attempt_number integer not null check (attempt_number > 0),
    idempotency_key VARCHAR(255) NOT NULL,
    status varchar(20) not null check (
        status in ('started', 'success', 'failed')
                                      ),
    started_at timestamp not null default now(),
    completed_at timestamp,
    external_post text,
    response jsonb,
    error_message text,

    constraint publish_attempt_number_unique unique (schedule_id, attempt_number)
);

create index idx_publish_attempts_schedule_id on publish_attempts (schedule_id);
create index idx_publish_attempts_status on publish_attempts (status);
create index idx_publish_attempts_started_at on publish_attempts (started_at desc);

create table generation_jobs (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references posts(id) on delete cascade,
    status varchar(20) not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
    attempts integer not null default 0 check (attempts >= 0),
    error text,
    started_at timestamp,
    completed_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);

create index idx_generation_jobs_post_id on generation_jobs (post_id);
create index idx_generation_jobs_status on generation_jobs (status);
create index idx_generation_jobs_created_at on generation_jobs (created_at desc);
import type { PoolClient } from "pg";
import { pool } from "../../database/db.js";
import type {
    CreateScheduleResult,
    ISchedulesRepository,
    Schedule,
    ScheduleStatus,
} from "./schedules.types.js";

interface ScheduleRow {
    id: string;
    variant_id: string;
    scheduled_at: Date;
    status: ScheduleStatus;
    idempotency_key: string;
    attempt_count: number;
    last_error: string | null;
    locked_at: Date | null;
    created_at: Date;
    updated_at: Date;
    completed_at: Date | null;
}

const SCHEDULE_COLUMNS =
    "id, variant_id, scheduled_at, status, idempotency_key, attempt_count, last_error, locked_at, created_at, updated_at, completed_at";

const mapScheduleRow = (row: ScheduleRow): Schedule => ({
    id: row.id,
    variantId: row.variant_id,
    scheduledAt: row.scheduled_at,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    lockedAt: row.locked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
});

export class SchedulesRepository implements ISchedulesRepository {
    async create(
        variantId: string,
        scheduledAt: Date,
        idempotencyKey: string,
    ): Promise<CreateScheduleResult> {
        const inserted = await pool.query(
            `
            INSERT INTO schedules (variant_id, scheduled_at, idempotency_key)
            VALUES ($1, $2, $3)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING ${SCHEDULE_COLUMNS}
            `,
            [variantId, scheduledAt, idempotencyKey],
        );

        if (inserted.rows[0]) {
            return {
                schedule: mapScheduleRow(inserted.rows[0]),
                created: true,
            };
        }

        const existing = await pool.query(
            `SELECT ${SCHEDULE_COLUMNS} FROM schedules WHERE idempotency_key = $1`,
            [idempotencyKey],
        );

        return {
            schedule: mapScheduleRow(existing.rows[0]),
            created: false,
        };
    }

    async findById(scheduleId: string): Promise<Schedule | null> {
        const result = await pool.query<ScheduleRow>(
            `SELECT ${SCHEDULE_COLUMNS} FROM schedules WHERE id = $1`,
            [scheduleId],
        );
        return result.rows[0] ? mapScheduleRow(result.rows[0]) : null;
    }

    async findDuePending(now: Date): Promise<Schedule[]> {
        const result = await pool.query<ScheduleRow>(
            `
            SELECT ${SCHEDULE_COLUMNS} FROM schedules
            WHERE status = 'pending' AND scheduled_at <= $1
            ORDER BY scheduled_at
            `,
            [now],
        );
        return result.rows.map(mapScheduleRow);
    }

    async reclaimStaleProcessing(
        leaseSeconds: number,
        maxAttempts: number,
    ): Promise<Schedule[]> {
        const requeued = await pool.query<ScheduleRow>(
            `
        UPDATE schedules
        SET status = 'pending', last_error = 'Requeued after worker interruption', updated_at = NOW()
        WHERE status = 'processing' AND locked_at IS NOT NULL
          AND locked_at < NOW() - make_interval(secs => $1)
          AND attempt_count < $2
        RETURNING ${SCHEDULE_COLUMNS}
    `,
            [leaseSeconds, maxAttempts],
        );

        await pool.query(
            `
        UPDATE schedules
        SET status = 'failed', last_error = 'Exceeded max attempts after worker crash',
            completed_at = NOW(), updated_at = NOW()
        WHERE status = 'processing' AND locked_at IS NOT NULL
          AND locked_at < NOW() - make_interval(secs => $1)
          AND attempt_count >= $2
    `,
            [leaseSeconds, maxAttempts],
        );

        return requeued.rows.map(mapScheduleRow);
    }

    async claim(client: PoolClient, id: string): Promise<Schedule | null> {
        const result = await client.query<ScheduleRow>(
            `
        UPDATE schedules
        SET status = 'processing', locked_at = NOW(), attempt_count = attempt_count + 1, updated_at = NOW()
        WHERE id = $1 AND status = 'pending' AND scheduled_at <= NOW()
        RETURNING ${SCHEDULE_COLUMNS}
    `,
            [id],
        );
        return result.rows[0] ? mapScheduleRow(result.rows[0]) : null;
    }

    async markStatus(
        client: PoolClient,
        id: string,
        status: ScheduleStatus,
        error: string | null = null,
    ): Promise<void> {
        await client.query(
            `UPDATE schedules
         SET status = $2, last_error = $3,
             completed_at = CASE WHEN $2 = 'success' THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE id = $1`,
            [id, status, error],
        );
    }
}

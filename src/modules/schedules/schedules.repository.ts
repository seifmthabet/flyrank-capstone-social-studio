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
}

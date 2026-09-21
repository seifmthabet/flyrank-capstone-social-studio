import { pool } from "../../database/db.js";
import type {
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

const SCHEDULE_COLUMNS = `id, variant_id, scheduled_at, status, idempotency_key, attempt_count, last_error, locked_at, created_at, updated_at, completed_at`;

const mapRowToSchedule = (row: ScheduleRow): Schedule => ({
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
    async createSchedule(input: {
        variantId: string;
        scheduledAt: Date;
        idempotencyKey: string;
    }): Promise<Schedule> {
        const result = await pool.query<ScheduleRow>(
            `
                INSERT INTO schedules (variant_id, scheduled_at, idempotency_key)
                VALUES ($1, $2, $3)
                RETURNING ${SCHEDULE_COLUMNS}
            `,
            [input.variantId, input.scheduledAt, input.idempotencyKey],
        );

        return mapRowToSchedule(result.rows[0] as ScheduleRow);
    }

    async findScheduleById(id: string): Promise<Schedule | null> {
        const result = await pool.query<ScheduleRow>(
            `
                SELECT ${SCHEDULE_COLUMNS}
                FROM schedules
                WHERE id = $1
            `,
            [id],
        );

        if (result.rows.length === 0) {
            return null;
        }

        return mapRowToSchedule(result.rows[0] as ScheduleRow);
    }

    async findSchedulesByVariantId(variantId: string): Promise<Schedule[]> {
        const result = await pool.query<ScheduleRow>(
            `
                SELECT ${SCHEDULE_COLUMNS}
                FROM schedules
                WHERE variant_id = $1
            `,
            [variantId],
        );

        return result.rows.map((row) => mapRowToSchedule(row as ScheduleRow));
    }

    async findPendingSchedules(): Promise<Schedule[]> {
        const result = await pool.query<ScheduleRow>(
            `
                SELECT ${SCHEDULE_COLUMNS}
                FROM schedules
                WHERE status = 'pending'
            `,
        );

        return result.rows.map((row) => mapRowToSchedule(row as ScheduleRow));
    }

    async updateSchedule(
        id: string,
        input: Partial<Omit<Schedule, "id" | "variantId" | "createdAt" | "updatedAt">>,
    ): Promise<void> {
        const fields = Object.keys(input);
        const values = Object.values(input);

        if (fields.length === 0) {
            return;
        }

        const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(", ");

        await pool.query(
            `
                UPDATE schedules
                SET ${setClause}, updated_at = NOW()
                WHERE id = $${fields.length + 1}
            `,
            [...values, id],
        );
    }
}

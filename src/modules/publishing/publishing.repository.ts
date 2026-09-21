import { pool } from "../../database/db.js";
import type {
    AttemptStatus,
    IPublishingRepository,
    PublishingAttempt,
} from "./publishing.types.js";

interface AttemptRow {
    id: string;
    schedule_id: string;
    attempt_number: number;
    idempotency_key: string;
    status: AttemptStatus;
    started_at: Date;
    completed_at: Date | null;
    external_post_id: string | null;
    response: unknown | null;
    error: string | null;
}

const ATTEMPT_COLUMNS = `id, schedule_id, attempt_number, idempotency_key, status, started_at, completed_at, external_post_id, response, error`;

const mapAttemptRow = (row: AttemptRow): PublishingAttempt => {
    return {
        id: row.id,
        scheduleId: row.schedule_id,
        attemptNumber: row.attempt_number,
        idempotencyKey: row.idempotency_key,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        externalPostId: row.external_post_id,
        response: row.response,
        error: row.error,
    };
};

export class PublishingRepository implements IPublishingRepository {
    async createAttempt(input: {
        scheduleId: string;
        idempotencyKey: string;
    }): Promise<PublishingAttempt> {
        const result = await pool.query<AttemptRow>(
            `
            INSERT INTO publish_attempts (schedule_id, attempt_number, idempotency_key, status)
        SELECT $1, COALESCE(MAX(attempt_number), 0) + 1, $2, 'started'
        FROM publish_attempts
        WHERE schedule_id = $1
        RETURNING ${ATTEMPT_COLUMNS}
            `,
            [input.scheduleId, input.idempotencyKey],
        );

        return mapAttemptRow(result.rows[0] as AttemptRow);
    }

    async completeAttempt(
        id: string,
        {
            status,
            externalPostId,
            response,
            error,
        }: {
            status: Exclude<AttemptStatus, "started">;
            externalPostId: string | null;
            response: unknown | null;
            error: string | null;
        },
    ): Promise<void> {
        await pool.query(
            `
        UPDATE publish_attempts
        SET status = $2, completed_at = NOW(),
            external_post_id = $3, response = $4, error = $5
        WHERE id = $1
    `,
            [
                id,
                status,
                externalPostId ?? null,
                response === undefined ? null : JSON.stringify(response),
                error ?? null,
            ],
        );
    }

    async findAttemptsByScheduleId(
        scheduleId: string,
    ): Promise<PublishingAttempt[]> {
        const result = await pool.query<AttemptRow>(
            `
        SELECT ${ATTEMPT_COLUMNS} FROM publish_attempts
        WHERE schedule_id = $1 ORDER BY attempt_number ASC
    `,
            [scheduleId],
        );
        return result.rows.map(mapAttemptRow);
    }
}

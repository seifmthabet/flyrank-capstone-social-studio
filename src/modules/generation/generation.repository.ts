import type {GenerationJob, GenerationStatus, IGenerationRepository} from "./generation.types.js";
import pool from "../../database/db.js";

interface GenerationJobRow {
    id: string;
    post_id: string;
    status: GenerationStatus;
    attempts: number;
    error: string | null;
    started_at: Date | null;
    completed_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

const JOB_COLUMNS = "id, post_id, status, attempts, error, started_at, completed_at, created_at, updated_at";

const mapGenerationJobRow = (row: GenerationJobRow): GenerationJob => ({
    id: row.id,
    postId: row.post_id,
    status: row.status,
    attempts: row.attempts,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});


export class GenerationRepository implements IGenerationRepository {
    constructor() {}

    /** Persists and returns a generation job in its initial queued state. */
    async create(postId: string): Promise<GenerationJob> {
        const result = await pool.query<GenerationJobRow>(`
            INSERT INTO generation_jobs (post_id)
            VALUES ($1)
            RETURNING ${JOB_COLUMNS}
        `, [postId]);

        return mapGenerationJobRow(result.rows[0]!);
    }

    /** Returns a generation job by ID, or `null` when it does not exist. */
    async findById(id: string): Promise<GenerationJob | null> {
        const result = await pool.query<GenerationJobRow>(`
            SELECT ${JOB_COLUMNS}
            FROM generation_jobs
            WHERE id = $1
        `, [id]);

        const row = result.rows[0];

        return row ? mapGenerationJobRow(row) : null;

    }

    /** Marks a job as processing, increments its attempt count, and records its start time. */
    async setStatusProcessing(id: string): Promise<void> {
        await pool.query(`
            UPDATE generation_jobs
            SET status = 'processing', attempts = attempts + 1, started_at = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [id]);
    }

    /** Marks a job as completed and records its completion time. */
    async setStatusCompleted(id: string): Promise<void> {
        await pool.query(`
            UPDATE generation_jobs
            SET status = 'completed', completed_at = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [id]);
    }

    /** Marks a job as failed and stores the provided error and completion time. */
    async setStatusFailed(id: string, error: string): Promise<void> {
        await pool.query(`
            UPDATE generation_jobs
            SET status = 'failed', error = $2, completed_at = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [id, error]);
    }
}

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

    async create(postId: string): Promise<GenerationJob> {
        const result = await pool.query<GenerationJobRow>(`
            INSERT INTO generation_jobs (post_id)
            VALUES ($1)
            RETURNING ${JOB_COLUMNS}
        `, [postId]);

        return mapGenerationJobRow(result.rows[0]!);
    }

    async findById(id: string): Promise<GenerationJob | null> {
        const result = await pool.query<GenerationJobRow>(`
            SELECT ${JOB_COLUMNS}
            FROM generation_jobs
            WHERE id = $1
        `, [id]);

        const row = result.rows[0];

        return row ? mapGenerationJobRow(row) : null;

    }

    async setStatusProcessing(id: string): Promise<void> {
        await pool.query(`
            UPDATE generation_jobs
            SET status = 'processing', attempts = attempts + 1, started_at = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [id]);
    }

    async setStatusCompleted(id: string): Promise<void> {
        await pool.query(`
            UPDATE generation_jobs
            SET status = 'completed', completed_at = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [id]);
    }

    async setStatusFailed(id: string, error: string): Promise<void> {
        await pool.query(`
            UPDATE generation_jobs
            SET status = 'failed', error = $2, completed_at = NOW(), updated_at = NOW()
            WHERE id = $1
        `, [id, error]);
    }
}
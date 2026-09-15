import type {IGenerationRepository} from "./generation.types.js";
import pool from "../../database/db.js";


class GenerationRepository implements IGenerationRepository {
    constructor() {}

    async setStatusProcessing(id: string) {
        const result = await pool.query(`
            UPDATE generation_jobs
            SET
                status = 'processing',
                attempts = attempts + 1,
                started_at = NOW(),
                updated_at = NOW()
            WHERE id = $1;
        `, [id])
    }

    async setStatusCompleted(id: string) {
        const result = await pool.query(`
            UPDATE generation_jobs
            SET
                status = 'completed',
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = $1;
        `, [id])
    }

    async setStatusFailed(id: string, error: string) {
        const result = await pool.query(`
            UPDATE generation_jobs
            SET
                status = 'failed',
                error = $2,
                updated_at = NOW()
            WHERE id = $1;
        `, [id, error])
    }
}
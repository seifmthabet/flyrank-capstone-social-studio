import pool from "../../database/db.js";
import type { IPlatformRepository, Platform } from "./platforms.types.js";

interface PlatformRow {
    id: string;
    code: string;
    name: string;
    max_length: number;
    tone: string;
    max_hashtags: number;
    adapter: string;
    enabled: boolean;
    created_at: Date;
    updated_at: Date;
}

const mapPlatformRow = (row: PlatformRow): Platform => ({
    id: row.id,
    code: row.code,
    name: row.name,
    maxLength: row.max_length,
    tone: row.tone,
    maxHashtags: row.max_hashtags,
    adapter: row.adapter,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export class PlatformsRepository implements IPlatformRepository {
    async listEnabled(): Promise<Platform[]> {
        const result = await pool.query<PlatformRow>(`
            SELECT id, code, name, max_length, tone, max_hashtags, adapter, enabled, created_at, updated_at
            FROM platforms
            WHERE enabled = true
            ORDER BY name
        `);
        return result.rows.map(mapPlatformRow);
    }
}

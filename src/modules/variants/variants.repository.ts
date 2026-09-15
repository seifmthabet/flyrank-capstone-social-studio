import type {IVariantsRepository, UpsertVariantInput, Variant, VariantStatus} from "./variants.types.js";
import pool from "../../database/db.js";

interface VariantRow {
    id: string;
    post_id: string;
    platform_id: string;
    content: string;
    status: VariantStatus;
    rejection_reason: string | null;
    generation_provider: string | null;
    generation_model: string | null;
    created_at: Date;
    updated_at: Date;
}

const VARIANT_COLUMNS = "id, post_id, platform_id, content, status, rejection_reason, generation_provider, generation_model, created_at, updated_at";

const mapVariantRow = (row: VariantRow): Variant => ({
    id: row.id,
    postId: row.post_id,
    platformId: row.platform_id,
    content: row.content,
    status: row.status,
    rejectionReason: row.rejection_reason,
    generationProvider: row.generation_provider,
    generationModel: row.generation_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export class VariantsRepository implements IVariantsRepository {
    /** Returns all variants associated with a post. */
    async findByPostId(postId: string): Promise<Variant[]> {
        const result = await pool.query<VariantRow>(`
            SELECT ${VARIANT_COLUMNS}
            FROM variants
            WHERE post_id = $1
        `, [postId]);

        return result.rows.map(mapVariantRow);
    }
    /**
     * Atomically inserts or refreshes one variant per platform for a post.
     * Existing variant status and rejection details are preserved during refreshes.
     */
    async upsertVariants(postId: string, inputs: UpsertVariantInput[]): Promise<void> {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            for (const input of inputs) {
                await client.query(`
                    INSERT INTO variants (post_id, platform_id, content, status, generation_provider, generation_model)
                    VALUES ($1, $2, $3, 'draft', $4, $5)
                    ON CONFLICT (post_id, platform_id)
                    DO UPDATE SET
                        content = EXCLUDED.content,
                        generation_provider = EXCLUDED.generation_provider,
                        generation_model = EXCLUDED.generation_model,
                        updated_at = NOW()
                `, [postId, input.platformId, input.content, input.provider, input.model]);
            }

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }
}

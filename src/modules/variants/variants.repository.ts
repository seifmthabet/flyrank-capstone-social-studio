import pool from "../../database/db.js";
import { AppError } from "../../shared/error.js";
import type {
    IVariantsRepository,
    UpsertVariantInput,
    Variant,
    VariantStatus,
} from "./variants.types.js";

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

const VARIANT_COLUMNS =
    "id, post_id, platform_id, content, status, rejection_reason, generation_provider, generation_model, created_at, updated_at";

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
    async findByPostId(postId: string): Promise<Variant[]> {
        const result = await pool.query<VariantRow>(
            `
            SELECT ${VARIANT_COLUMNS}
            FROM variants
            WHERE post_id = $1
        `,
            [postId],
        );

        return result.rows.map(mapVariantRow);
    }
    async upsertVariants(
        postId: string,
        inputs: UpsertVariantInput[],
    ): Promise<void> {
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            for (const input of inputs) {
                await client.query(
                    `
                    INSERT INTO variants (post_id, platform_id, content, status, generation_provider, generation_model)
                    VALUES ($1, $2, $3, 'draft', $4, $5)
                    ON CONFLICT (post_id, platform_id)
                    DO UPDATE SET
                        content = EXCLUDED.content,
                        status = CASE 
                            WHEN variants.status = 'rejected' THEN 'draft'
                            ELSE variants.status
                       END,
                        rejection_reason = CASE 
                            WHEN variants.status = 'rejected' THEN NULL
                            ELSE variants.rejection_reason
                        END,
                        generation_provider = EXCLUDED.generation_provider,
                        generation_model = EXCLUDED.generation_model,
                        updated_at = NOW()
                    WHERE variants.status NOT IN ('approved', 'scheduled', 'published')
                `,
                    [
                        postId,
                        input.platformId,
                        input.content,
                        input.provider,
                        input.model,
                    ],
                );
            }

            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    async findById(variantId: string): Promise<Variant | null> {
        const result = await pool.query(
            `
            SELECT ${VARIANT_COLUMNS}
            FROM variants
            WHERE id = $1
        `,
            [variantId],
        );
        return result.rows.length > 0 ? mapVariantRow(result.rows[0]) : null;
    }

    async editVariant(variantId: string, content: string): Promise<void> {
        const result = await pool.query(
            `
            UPDATE variants
            SET content = $1, updated_at = NOW()
            WHERE id = $2
        `,
            [content, variantId],
        );

        if (result.rowCount === 0) {
            throw AppError.notFound(`Variant with ID ${variantId} not found`);
        }
    }

    async approveVariant(variantId: string): Promise<void> {
        const result = await pool.query(
            `
            UPDATE variants
            SET status = 'approved', updated_at = NOW()
            WHERE id = $1
        `,
            [variantId],
        );

        if (result.rowCount === 0) {
            throw AppError.notFound(`Variant with ID ${variantId} not found`);
        }
    }

    async rejectVariant(variantId: string, reason: string): Promise<void> {
        const result = await pool.query(
            `
            UPDATE variants
            SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
            WHERE id = $1
        `,
            [variantId, reason],
        );

        if (result.rowCount === 0) {
            throw AppError.notFound(`Variant with ID ${variantId} not found`);
        }
    }

    async scheduleVariant(variantId: string, scheduledAt: Date): Promise<void> {
        const result = await pool.query(`
                INSERT INTO schedules ()
            `)
    }
}

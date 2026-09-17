import type { QueryResult } from "pg";
import pool from "../../database/db.js";
import type { CreatePostInput, IPostRepository, Post } from "./posts.types.js";

interface PostRow {
    id: string;
    source_type: "url" | "markdown";
    source_url: string | null;
    content: string;
    created_at: Date;
    updated_at: Date;
}

const mapPostRow = (row: PostRow): Post => {
    return {
        id: row.id,
        sourceType: row.source_type,
        sourceUrl: row.source_url,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

export class PostRepository implements IPostRepository {
    async create(input: CreatePostInput): Promise<Post> {
        let result: QueryResult<PostRow>;

        if (input.sourceType === "url") {
            result = await pool.query<PostRow>(
                `
                 INSERT INTO posts (source_type, source_url, content) VALUES ($1, $2, $3) RETURNING id, source_type, source_url, content, created_at, updated_at
                    `,
                [input.sourceType, input.url, input.content],
            );
        } else {
            result = await pool.query<PostRow>(
                `
                INSERT INTO posts (source_type, content) VALUES ($1, $2) RETURNING id, source_type, source_url, content, created_at, updated_at
                    `,
                [input.sourceType, input.content],
            );
        }

        return mapPostRow(result.rows[0] as PostRow);
    }

    async findById(id: string): Promise<Post | null> {
        const result = await pool.query<PostRow>(
            `
        SELECT id, source_type, source_url, content, created_at, updated_at FROM posts WHERE id = $1
        `,
            [id],
        );

        const row = result.rows[0];

        if (!row) {
            return null;
        }

        return mapPostRow(row);
    }
}

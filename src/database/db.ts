import { Pool, type PoolClient } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
    connectionString: env.db.url,
});

export const dbTransaction = async <T>(
    callback: (client: PoolClient) => Promise<T>,
): Promise<T> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

export default pool;

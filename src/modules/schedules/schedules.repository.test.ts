import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { SchedulesRepository } from "./schedules.repository.js";

test("markStatus uses a dedicated boolean parameter to set completion time", async () => {
    let query = "";
    let values: unknown[] = [];
    const client = {
        query: async (sql: string, parameters: unknown[]) => {
            query = sql;
            values = parameters;
            return { rows: [] };
        },
    } as unknown as PoolClient;

    await new SchedulesRepository().markStatus(
        client,
        "00000000-0000-4000-8000-000000000001",
        "success",
    );

    assert.match(query, /SET status = \$2, last_error = \$3/);
    assert.match(query, /WHEN \$4 THEN NOW\(\)/);
    assert.deepEqual(values, [
        "00000000-0000-4000-8000-000000000001",
        "success",
        null,
        true,
    ]);
});

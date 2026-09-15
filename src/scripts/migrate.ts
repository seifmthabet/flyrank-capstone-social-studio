import path from "path";
import * as fs from "node:fs";
import pool from "../database/db.js";


const migrate = async () => {
    const filePath = path.resolve("src/database/schema.sql")

    const sql = fs.readFileSync(filePath, 'utf-8');

    await pool.query(sql);

    console.log("Database migrated successfully");
}

migrate().catch((err) => {
    console.error("Migration failed: ", err);
    process.exit(1);
}).finally(async () => {
    await pool.end();
})
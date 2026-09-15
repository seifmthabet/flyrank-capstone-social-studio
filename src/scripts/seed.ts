import path from "path";
import * as fs from "node:fs";
import pool from "../database/db.js";


const seed = async () => {
    const filePath = path.resolve("src/database/seed.sql")

    const sql = fs.readFileSync(filePath, 'utf-8');

    await pool.query(sql);

    console.log("Database seeded successfully");
}

seed().catch((err) => {
    console.error("Seeding failed: ", err);
    process.exit(1);
}).finally(async () => {
    await pool.end();
})
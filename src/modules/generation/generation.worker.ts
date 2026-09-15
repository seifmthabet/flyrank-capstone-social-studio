import { Worker } from 'bullmq'
import { Redis } from "ioredis"
import {env} from "../../config/env.js";

const connection = {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password
}

export const generationWorker = new Worker('generation', async (job) => {
    const { generationJobId, postId } = job.data;
    console.log(`Proccessing generation job ${generationJobId} for post ${postId}`)

    // TODO:
    // 1. Load generation job
    // 2. Mark it as processing
    // 3. Load post
    // 4. Load platforms
    // 5. Call Groq
    // 6. Validate variants
    // 7. Save variants
    // 8. Mark generation job completed
}, {
    connection,
    concurrency: 2,
})

generationWorker.on('completed', (job) => {
    console.log(`Generation job ${job.id} completed`);
})

generationWorker.on('failed', (job, error) => {
    console.error(`Generation job ${job?.id} failed`, error);
})
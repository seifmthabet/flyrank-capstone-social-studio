import { Worker } from 'bullmq'
import { Redis } from "ioredis"
import {env} from "../../config/env.js";
import {GenerationRepository} from "./generation.repository.js";
import {GenerationService} from "./generation.service.js";
import {PostRepository} from "../posts/posts.repository.js";
import {PlatformsRepository} from "../platforms/platforms.repository.js";
import {VariantsRepository} from "../variants/variants.repository.js";
import {GroqAiProvider} from "../../ai/groq-provider.js";
import type {GenerationJobData} from "./generation.types.js";
import {createGenerationContainer} from "../../config/container.js";

const connection = {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password
}

const {generationService, generationRepository} = createGenerationContainer();

export const generationWorker = new Worker('generation', async (job) => {
    const data = job.data as GenerationJobData;
    await generationService.processGenerationJob(data.generationJobId, data.postId);

}, {
    connection,
    concurrency: 2,
})

generationWorker.on("completed", (job) => {
    console.log(`Generation job ${job.id} completed`);
});

generationWorker.on("failed", async (job, error) => {
    console.error(`Generation job ${job?.id} failed`, error);

    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        const data = job.data as GenerationJobData;
        try {
            await generationRepository.setStatusFailed(data.generationJobId, error.message);
        } catch (dbError) {
            console.error(`Failed to update generation job ${data.generationJobId} status to failed`, dbError);
        }
    }
});
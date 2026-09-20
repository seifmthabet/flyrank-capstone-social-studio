import { Worker } from "bullmq";
import { createGenerationContainer } from "../config/container.js";
import { env } from "../config/env.js";
import type { GenerationJobData } from "../modules/generation/generation.types.js";
import {recoverStaleGenerationJobs} from "../modules/generation/generation.recovery.js";

const connection = {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
};

const { generationService, generationRepository } = createGenerationContainer();

recoverStaleGenerationJobs(generationRepository).catch((error) => {
    console.error("Error recovering stale generation jobs:", error);
});

setInterval(() => {
    recoverStaleGenerationJobs(generationRepository).catch((error) => {
        console.error("Error recovering stale generation jobs:", error);
    });
}, 60000);

export const generationWorker = new Worker(
    "generation",
    async (job) => {
        const data = job.data as GenerationJobData;
        await generationService.processGenerationJob(
            data.generationJobId,
            data.postId,
        );
    },
    {
        connection,
        concurrency: 2,
    },
);

generationWorker.on("completed", (job) => {
    console.log(`Generation job ${job.id} completed`);
});

generationWorker.on("failed", async (job, error) => {
    console.error(`Generation job ${job?.id} failed`, error);

    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        const data = job.data as GenerationJobData;
        try {
            await generationRepository.setStatusFailed(
                data.generationJobId,
                error.message,
            );
        } catch (dbError) {
            console.error(
                `Failed to update generation job ${data.generationJobId} status to failed`,
                dbError,
            );
        }
    }
});

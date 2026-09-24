import { Worker } from "bullmq";
import { createPublishingContainer } from "../config/container.js";
import { env } from "../config/env.js";
import type { PublishingJobData } from "../modules/publishing/publishing.types.js";

const connection = {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
};

const { publishingService, publishingRepository } = createPublishingContainer();

export const publishingWorker = new Worker(
    "publishing",
    async (job) => {
        const data = job.data as PublishingJobData;
        await publishingService.publishSchdule(
            data.publishingJobId,
            data.scheduleId,
        );
    },
    {
        connection,
        concurrency: 2,
    },
);

publishingWorker.on("completed", async (job) => {
    console.log(`Publishing job ${job.id} completed`);
    await publishingRepository.completeAttempt(job.id as string, {
        status: "success",
        externalPostId: job.returnvalue?.externalPostId || null,
        response: job.returnvalue?.response || null,
        error: null,
    });
});

publishingWorker.on("failed", async (job, error) => {
    console.error(`Publishing job ${job?.id} failed`, error);

    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        const data = job.data as PublishingJobData;
        try {
            await publishingRepository.completeAttempt(job.id as string, {
                status: "failed",
                externalPostId: null,
                response: null,
                error: error.message,
            });
        } catch (dbError) {
            console.error(
                `Failed to update publishing job ${data.publishingJobId} status to failed`,
                dbError,
            );
        }
    }
});

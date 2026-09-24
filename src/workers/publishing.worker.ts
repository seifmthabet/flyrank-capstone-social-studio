import { Worker } from "bullmq";
import { createPublishingContainer } from "../config/container.js";
import { env } from "../config/env.js";
import { sweepDueSchedules } from "../modules/publishing/publishing.scheduler.js";
import type { PublishingJobData } from "../modules/publishing/publishing.types.js";

const connection = {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
};

const { publishingService, schedulesRepository } = createPublishingContainer();

sweepDueSchedules(schedulesRepository).catch((error) => {
    console.error("Error sweeping due schedules:", error);
});

setInterval(() => {
    sweepDueSchedules(schedulesRepository).catch((error) => {
        console.error("Publishing sweep failed:", error);
    });
}, 30_000);

export const publishingWorker = new Worker(
    "publishing",
    async (job) => {
        const data = job.data as PublishingJobData;
        return await publishingService.publishSchdule(data.scheduledId);
    },
    {
        connection,
        concurrency: 2,
    },
);

publishingWorker.on("completed", async (job) => {
    console.log(`Publishing job ${job.id} completed successfully.`);
});

publishingWorker.on("failed", async (job, err) => {
    console.error(`Publishing job ${job?.id} failed:`, err);
});

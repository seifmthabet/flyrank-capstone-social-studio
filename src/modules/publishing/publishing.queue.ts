import { Queue } from "bullmq";
import { env } from "../../config/env.js";
import type { EnqueuePublishJob } from "../schedules/schedules.types.js";
import type { PublishingJobData } from "./publishing.types.js";

const connection = {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
};

let queue: Queue | null = null;

export const enqueuePublishingJob: EnqueuePublishJob = async (input) => {
    queue ??= new Queue("publishing", {
        connection,
    });

    const data: PublishingJobData = { scheduledId: input.scheduleId };

    await queue.add("publish-schedule", data, {
        jobId: input.scheduleId,
        delay: Math.max(
            0,
            Date.parse(input.scheduledAt.toISOString()) - Date.now(),
        ),
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
    });
};

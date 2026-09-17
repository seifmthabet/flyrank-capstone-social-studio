import { Queue } from "bullmq";
import { env } from "../../config/env.js";
import type { GenerationJobData } from "./generation.types.js";

const connection = {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
};

const jobOptions = {
    attempts: 3,
    backoff: {
        type: "exponential" as const,
        delay: 2000,
    },
};

let queue: Queue | null = null;

export const enqueueGenerationJob = async (data: GenerationJobData) => {
    queue ??= new Queue("generation", {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
        },
    });
    await queue.add("generate-variants", data, jobOptions);
};

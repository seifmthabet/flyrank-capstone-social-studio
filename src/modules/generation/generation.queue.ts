import { Queue } from "bullmq"
import {env} from "../../config/env.js";

const connection = {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password
}

export const generationQueue = new Queue('generation', { connection });


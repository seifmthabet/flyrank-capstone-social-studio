import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
    api: z.object({
        port: z.coerce.number().int().positive().default(3000)
    }),
    db: z.object({
        url: z.string().url().optional()
    }),
    redis: z.object({
        host: z.string().optional(),
        port: z.coerce.number().int().positive().optional(),
        password: z.string().optional()
    }),
    ai: z.object({
        base_url: z.string().url("LLM_BASE_URL must be a valid URL"),
        api_key: z.string().min(1, "LLM_API_KEY is required"),
        model: z.string().min(1, "LLM_MODEL is required")
    }),
    telegram: z.object({
        bot_token: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
        chat_id: z.string().min(1, "TELEGRAM_CHAT_ID is required")
    })
})

const parsedEnv = envSchema.safeParse({
    api: {
        port: process.env.PORT ?? 3000
    },
    db: {
        url: process.env.DATABASE_URL
    },
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
    },
    ai: {
        base_url: process.env.LLM_API_BASE_URL,
        api_key: process.env.LLM_API_KEY,
        model: process.env.LLM_MODEL
    },
    telegram: {
        bot_token: process.env.TELEGRAM_BOT_TOKEN,
        chat_id: process.env.TELEGRAM_CHAT_ID
    }
})

if (!parsedEnv.success) {
    throw new Error(
        `Invalid configuration: ${JSON.stringify(parsedEnv.error.flatten(), null, 2)}`
    );
}
export const env = parsedEnv.data;
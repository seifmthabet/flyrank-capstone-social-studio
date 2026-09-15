import 'dotenv/config'

export const env = {
    api: {
        port: process.env.PORT || 3000
    },
    db: {
        url: process.env.DATABASE_URL
    },
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
    }
}
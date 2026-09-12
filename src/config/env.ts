import 'dotenv/config'

export const env = {
    api: {
        port: process.env.PORT || 3000
    },
    db: {
        url: process.env.DATABASE_URL
    }
}
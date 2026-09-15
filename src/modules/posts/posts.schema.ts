import z from "zod";

export const postSchema = z.object({
    id: z.string(),
    sourceType: z.enum(["url", "markdown"]),
    sourceUrl: z.string().nullable(),
    content: z.string(),
    createdAt: z.date(),
    updatedAt: z.date()
})

export const createPostSchema = z.object({
    sourceType: z.enum(["url", "markdown"]),
    url: z.string().nullable(),
    content: z.string().nullable()
})


export type CreatePostInput = z.infer<typeof createPostSchema>
export type Post = z.infer<typeof postSchema>
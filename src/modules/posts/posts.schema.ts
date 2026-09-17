import z from "zod";

export const postSchema = z.object({
    id: z.string(),
    sourceType: z.enum(["url", "markdown"]),
    sourceUrl: z.string().nullable(),
    content: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const createPostSchema = z.discriminatedUnion("sourceType", [
    z.object({
        sourceType: z.literal("url"),
        url: z.string().trim().min(1),
        content: z.string().trim().min(1).optional(),
    }),
    z.object({
        sourceType: z.literal("markdown"),
        content: z.string().trim().min(1),
    }),
]);

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type Post = z.infer<typeof postSchema>;

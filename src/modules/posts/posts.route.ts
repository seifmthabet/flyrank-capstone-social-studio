import { type Request, type Response, Router } from "express";
import { createPostSchema } from "./posts.schema.js";
import type { PostService } from "./posts.service.js";

export const createPostsRoute = (deps: { postService: PostService }) => {
    const postsRouter = Router();

    postsRouter.post("/", async (req: Request, res: Response) => {
        const parsed = createPostSchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                error: parsed.error.flatten(),
            });
        }

        if (parsed.data.sourceType === "markdown") {
            const post = await deps.postService.ingestMarkdown({
                content: parsed.data.content,
            });
            return res.status(201).json({
                data: post,
            });
        }

        if (parsed.data.sourceType === "url") {
            const post = await deps.postService.ingestUrl({
                url: parsed.data.url,
            });
            return res.status(201).json({
                data: post,
            });
        }

        return res.status(400).json({
            error: "sourceType must be either 'url' or 'markdown' ",
        });
    });

    postsRouter.get("/:id", async (req: Request, res: Response) => {
        const postId = String(req.params.id);
        const post = await deps.postService.getPostById(postId);
        return res.status(200).json({
            data: post,
        });
    });

    return postsRouter;
};

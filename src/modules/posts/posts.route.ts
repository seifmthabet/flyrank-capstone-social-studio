import {UrlFetcher} from "../../ingestion/url-fetcher.js";
import {ArticleExtractor} from "../../ingestion/article-extractor.js";
import {MarkdownConverter} from "../../ingestion/markdown-converter.js";
import {PostRepository} from "./posts.repository.js";
import {PostService} from "./posts.service.js";
import {Router, type Request, type Response} from "express";
import {createPostSchema} from "./posts.schema.js";


const urlFeatcher = new UrlFetcher();
const articleExtractor = new ArticleExtractor();
const markdownConverter = new MarkdownConverter();
const postRepository = new PostRepository();

const postService = new PostService(urlFeatcher, articleExtractor, markdownConverter, postRepository);

const postsRouter = Router()


postsRouter.post("/", async (req: Request, res: Response) => {
    const parsed = createPostSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: parsed.error.flatten()
        })
    }

    const { sourceType, url, content } = parsed.data;

    if (sourceType === "markdown") {
        const post = await postService.ingestMarkdown({content: content!});
        return res.status(201). json({
            data: post
        })
    }

    if (sourceType === "url") {
        const post = await postService.ingestUrl({url: url!});
        return res.status(201).json({
            data: post
        })
    }

    return res.status(400).json({
        error: "sourceType must be either 'url' or 'markdown' "
    })
})

postsRouter.get("/:id", async (req: Request, res: Response) => {
    const postId = String(req.params.id)
    const post = await postService.getPostById(postId)
    return res.status(200).json({
        data: post
    })
})


export default postsRouter;
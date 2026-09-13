import {UrlFetcher} from "../../ingestion/url-fetcher.js";
import {ArticleExtractor} from "../../ingestion/article-extractor.js";
import {MarkdownConverter} from "../../ingestion/markdown-converter.js";
import {PostRepository} from "./posts.repository.js";
import {PostService} from "./posts.service.js";
import {Router, type Request, type Response} from "express";


const urlFeatcher = new UrlFetcher();
const articleExtractor = new ArticleExtractor();
const markdownConverter = new MarkdownConverter();
const postRepository = new PostRepository();

const postService = new PostService(urlFeatcher, articleExtractor, markdownConverter, postRepository);

const postsRouter = Router()


postsRouter.post("/", async (req: Request, res: Response) => {
    try {
        const { sourceType, url, content } = req.body;

        if (sourceType === "markdown") {
            const post = await postService.ingestMarkdown(content);
            return res.status(201). json({
                data: post
            })
        }

        if (sourceType === "url") {
            const post = await postService.ingestUrl({url});
            return res.status(201).json({
                data: post
            })
        }

        return res.status(400).json({
            error: "sourceType must be either 'url' or 'markdown' "
        })

    } catch (error) {
        console.error(error)
        return res.status(500).json({
            error: "Failed ingest post"
        })
    }
})

postsRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        const postId = String(req.params.id)

        const post = await postService.getPostById(postId)

        if (!post) {
            return res.status(404).json({
                message: "post not found"
            })
        }

        return res.status(200).json({
            data: post
        })

    } catch (error) {
        console.error(error)
        return res.status(500).json({
            error: "Failed to get post"
        })
    }
})


export default postsRouter;
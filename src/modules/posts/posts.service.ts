import type {IngestMarkdownInput, IngestUrlInput, IPostRepository, IPostService, Post} from "./posts.types.js";
import type {UrlFetcher} from "../../ingestion/url-fetcher.js";
import type {ArticleExtractor} from "../../ingestion/article-extractor.js";
import type {MarkdownConverter} from "../../ingestion/markdown-converter.js";
import {AppError} from "../../shared/error.js";

export class PostService implements IPostService{
    constructor(
        private readonly urlfetcher: UrlFetcher,
        private readonly articleExtractor: ArticleExtractor,
        private readonly markdownConverter: MarkdownConverter,
        private readonly postRepository: IPostRepository
    ) {}

    /**
     * Trims and persists Markdown as a post without a source URL.
     *
     * @throws {Error} If the Markdown is blank.
     */
    async ingestMarkdown(input: IngestMarkdownInput): Promise<Post> {
        const content = input.content.trim();

        if (!content) {
            throw new Error("Content is required");
        }

        return this.postRepository.create({
            sourceType: "markdown",
            sourceUrl: null,
            content
        })
    }

    /**
     * Fetches an article, converts its extracted HTML to Markdown, and persists the post.
     * Fetch and article-extraction failures are propagated.
     *
     * @throws {Error} If the URL is blank or the converted article is empty.
     */
    async ingestUrl(input: IngestUrlInput): Promise<Post> {
        const url = input.url.trim();

        if (!url) {
            throw new Error("URL is required");
        }

        const html = await this.urlfetcher.fetch(url);
        const article = this.articleExtractor.extract(html, url);
        const content = this.markdownConverter.convert(article.content);

        if (!content) {
            throw new Error("Failed to convert article to markdown");
        }

        return this.postRepository.create({
            sourceType: "url",
            sourceUrl: url,
            content
        })
    }

    /** Returns a post by ID, or `null` when it does not exist. */
    async getPostById(id: string): Promise<Post | null> {
        const post = this.postRepository.findById(id)

        if (!post) {
            throw AppError.notFound("Post not found");
        }

        return post;
    }
}

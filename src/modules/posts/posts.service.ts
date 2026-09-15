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

    async ingestMarkdown(input: IngestMarkdownInput): Promise<Post> {
        const content = input.content.trim();

        if (!content) {
            throw AppError.badRequest("Markdown content is required");
        }

        return await this.postRepository.create({
            sourceType: "markdown",
            sourceUrl: null,
            content
        })
    }

    async ingestUrl(input: IngestUrlInput): Promise<Post> {
        const url = input.url.trim();

        if (!url) {
            throw AppError.badRequest("URL is required");
        }

        const html = await this.urlfetcher.fetch(url);
        const article = this.articleExtractor.extract(html, url);
        const content = this.markdownConverter.convert(article.content);

        if (!content) {
            throw AppError.badRequest("Failed to extract content from the URL");
        }

        return await this.postRepository.create({
            sourceType: "url",
            sourceUrl: url,
            content
        })
    }

    async getPostById(id: string): Promise<Post | null> {
        const post = await this.postRepository.findById(id)

        if (!post) {
            throw AppError.notFound("Post not found");
        }

        return post;
    }
}
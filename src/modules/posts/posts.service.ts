import type {IngestMarkdownInput, IngestUrlInput, IPostRepository, IPostService, Post} from "./posts.types.js";
import type {UrlFetcher} from "../../ingestion/url-fetcher.js";
import type {ArticleExtractor} from "../../ingestion/article-extractor.js";
import type {MarkdownConverter} from "../../ingestion/markdown-converter.js";

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
            throw new Error("Content is required");
        }

        return this.postRepository.create({
            sourceType: "markdown",
            content
        })
    }

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

    async getPostById(id: string): Promise<Post | null> {
        const post = this.postRepository.findById(id)

        if (!post) {
            throw new Error("Post not found");
        }

        return post;
    }
}
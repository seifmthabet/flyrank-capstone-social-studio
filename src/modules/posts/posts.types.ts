import type {CreatePostInput, Post} from "./posts.schema.js";

interface IPostRepository {
    create: (input: CreatePostInput) => Promise<Post>;
    findById: (id: string) => Promise<Post | null>;
}

interface IngestMarkdownInput {
    content: string;
}
interface IngestUrlInput {
    url: string;
}

interface IPostService {
    ingestMarkdown: (input: IngestMarkdownInput) => Promise<Post>;
    ingestUrl: (input: IngestUrlInput) => Promise<Post>;
    getPostById: (id: string) => Promise<Post | null>;
}

export type { Post, CreatePostInput, IPostRepository , IPostService, IngestUrlInput, IngestMarkdownInput};
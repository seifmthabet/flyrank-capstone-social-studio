interface Post {
    id: string;
    sourceType: "url" | "markdown";
    sourceUrl: string | null;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

interface CreatePostInput {
    sourceType: "url" | "markdown";
    sourceUrl?: string;
    content: string;
}

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
}

export type { Post, CreatePostInput, IPostRepository , IPostService, IngestUrlInput, IngestMarkdownInput};
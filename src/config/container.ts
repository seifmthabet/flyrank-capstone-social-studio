import { GroqAiProvider } from "../ai/groq-provider.js";
import { ArticleExtractor } from "../ingestion/article-extractor.js";
import { MarkdownConverter } from "../ingestion/markdown-converter.js";
import { UrlFetcher } from "../ingestion/url-fetcher.js";
import { GenerationRepository } from "../modules/generation/generation.repository.js";
import { GenerationService } from "../modules/generation/generation.service.js";
import type {
    IGenerationRepository,
    IGenerationService,
} from "../modules/generation/generation.types.js";
import { PlatformsRepository } from "../modules/platforms/platforms.repository.js";
import { PostRepository } from "../modules/posts/posts.repository.js";
import { PostService } from "../modules/posts/posts.service.js";
import { enqueuePublishingJob } from "../modules/publishing/publishing.queue.js";
import { PublishingRepository } from "../modules/publishing/publishing.repository.js";
import { PublishingService } from "../modules/publishing/publishing.service.js";
import { SchedulesRepository } from "../modules/schedules/schedules.repository.js";
import { SchedulesService } from "../modules/schedules/schedules.service.js";
import { VariantsRepository } from "../modules/variants/variants.repository.js";
import { VariantsService } from "../modules/variants/variants.service.js";
import { getPublisher } from "../publishing/adapter-registry.js";
import { env } from "./env.js";

export interface GenerationContainer {
    generationService: IGenerationService;
    generationRepository: IGenerationRepository;
}

export const createPostContainer = () => {
    const postRepository = new PostRepository();
    const postService = new PostService(
        new UrlFetcher(),
        new ArticleExtractor(),
        new MarkdownConverter(),
        postRepository,
    );
    return { postRepository, postService };
};

export const createGenerationContainer = (): GenerationContainer => {
    const generationRepository = new GenerationRepository();

    const generationService = new GenerationService(
        generationRepository,
        new PostRepository(),
        new PlatformsRepository(),
        new VariantsRepository(),
        new GroqAiProvider(env.ai.model),
    );

    return { generationService, generationRepository };
};

export const createVariantsContainer = () => {
    const variantsRepository = new VariantsRepository();
    const variantsService = new VariantsService(
        variantsRepository,
        new PlatformsRepository(),
    );

    return { variantsService, variantsRepository };
};

export const createSchedulesContainer = () => {
    const schedulesRepository = new SchedulesRepository();
    const schedulesService = new SchedulesService(
        schedulesRepository,
        new VariantsRepository(),
        enqueuePublishingJob,
    );
    return { schedulesService };
};

export const createPublishingContainer = () => {
    const publishingRepository = new PublishingRepository();
    const schedulesRepository = new SchedulesRepository();
    const publishingService = new PublishingService(
        schedulesRepository,
        new VariantsRepository(),
        new PlatformsRepository(),
        publishingRepository,
        getPublisher,
    );
    return { publishingService, publishingRepository, schedulesRepository };
};

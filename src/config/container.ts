import type {IGenerationRepository, IGenerationService} from "../modules/generation/generation.types.js";
import {GenerationRepository} from "../modules/generation/generation.repository.js";
import {GenerationService} from "../modules/generation/generation.service.js";
import {PostRepository} from "../modules/posts/posts.repository.js";
import {PlatformsRepository} from "../modules/platforms/platforms.repository.js";
import {VariantsRepository} from "../modules/variants/variants.repository.js";
import {GroqAiProvider} from "../ai/groq-provider.js";
import {env} from "./env.js";
import {VariantsService} from "../modules/variants/variants.service.js";
import {PostService} from "../modules/posts/posts.service.js";
import {UrlFetcher} from "../ingestion/url-fetcher.js";
import {ArticleExtractor} from "../ingestion/article-extractor.js";
import {MarkdownConverter} from "../ingestion/markdown-converter.js";

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
        postRepository
    );
    return { postRepository, postService };
}

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
    )

    return { variantsService, variantsRepository };
}
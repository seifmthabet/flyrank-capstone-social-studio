import type {IGenerationRepository, IGenerationService} from "../modules/generation/generation.types.js";
import {GenerationRepository} from "../modules/generation/generation.repository.js";
import {GenerationService} from "../modules/generation/generation.service.js";
import {PostRepository} from "../modules/posts/posts.repository.js";
import {PlatformsRepository} from "../modules/platforms/platforms.repository.js";
import {VariantsRepository} from "../modules/variants/variants.repository.js";
import {GroqAiProvider} from "../ai/groq-provider.js";
import {env} from "./env.js";

export interface GenerationContainer {
    generationService: IGenerationService;
    generationRepository: IGenerationRepository;
}

/** Creates a generation service and exposes the repository instance backing it. */
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

import type { AiProvider } from "../../ai/ai-provider.js";
import { VariantValidator } from "../../ai/variant-validator.js";
import { AppError } from "../../shared/error.js";
import type {
    IPlatformRepository,
    Platform,
} from "../platforms/platforms.types.js";
import type { IPostRepository } from "../posts/posts.types.js";
import type {
    IVariantsRepository,
    Variant,
} from "../variants/variants.types.js";
import { enqueueGenerationJob } from "./generation.queue.js";
import type {
    GenerationJob,
    IGenerationRepository,
    IGenerationService,
} from "./generation.types.js";

export class GenerationService implements IGenerationService {
    private readonly validator = new VariantValidator();

    constructor(
        private readonly generationRepository: IGenerationRepository,
        private readonly postRepository: IPostRepository,
        private readonly platformRepository: IPlatformRepository,
        private readonly variantsRepository: IVariantsRepository,
        private readonly aiProvider: AiProvider,
    ) {}

    async createGenerationJob(postId: string): Promise<GenerationJob> {
        const post = await this.postRepository.findById(postId);

        if (!post) {
            throw AppError.notFound(`Post not found`, "POST_NOT_FOUND");
        }

        const job = await this.generationRepository.create(postId);

        try {
            await enqueueGenerationJob({
                generationJobId: job.id,
                postId,
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to enqueue generation job";
            await this.generationRepository
                .setStatusFailed(job.id, message)
                .catch((_err) => {});

            throw AppError.internal(message, "ENQUEUE_FAILED");
        }

        return job;
    }

    async getGenerationJob(id: string): Promise<GenerationJob> {
        const job = await this.generationRepository.findById(id);

        if (!job) {
            throw AppError.notFound(
                "Generation job not found",
                "JOB_NOT_FOUND",
            );
        }

        return job;
    }

    async processGenerationJob(jobId: string, postId: string): Promise<void> {
        const job = await this.generationRepository.findById(jobId);

        if (!job) {
            throw AppError.notFound(
                `Generation job ${jobId} not found`,
                "JOB_NOT_FOUND",
            );
        }

        if (job.status === "completed") {
            return;
        }

        await this.generationRepository.setStatusProcessing(jobId);

        const post = await this.postRepository.findById(postId);

        if (!post) {
            throw AppError.notFound(`Post not found`, "POST_NOT_FOUND");
        }

        const platforms = await this.platformRepository.listEnabled();

        if (platforms.length === 0) {
            throw AppError.badRequest(
                "No enabled platforms found",
                "NO_ENABLED_PLATFORMS",
            );
        }

        await this.ensureNothingApprovedOrPublished(postId);

        const results = await Promise.all(
            platforms.map((p) =>
                this.generateVariantForPlatform(post.content, p),
            ),
        );

        await this.variantsRepository.upsertVariants(postId, results);

        await this.generationRepository.setStatusCompleted(jobId);
    }

    async getGenerationVariants(postId: string): Promise<Variant[]> {
        const variants = await this.variantsRepository.findByPostId(postId);
        if (variants.length === 0) {
            throw AppError.notFound(
                `No variants found for post ${postId}`,
                "VARIANTS_NOT_FOUND",
            );
        }
        return variants;
    }

    private async generateVariantForPlatform(
        postContent: string,
        platform: Platform,
    ) {
        const result = await this.aiProvider.generateVariant({
            postContent,
            platform,
        });
        this.validator.validate(result.content, platform);

        return {
            platformId: platform.id,
            content: result.content,
            provider: result.provider,
            model: result.model,
        };
    }

    private async ensureNothingApprovedOrPublished(
        postId: string,
    ): Promise<void> {
        const variants = await this.variantsRepository.findByPostId(postId);

        const locked = variants.find(
            (v) => v.status === "approved" || v.status === "published",
        );

        if (locked) {
            throw AppError.conflict(
                `Cannot regenerate: a variant is already ${locked.status}`,
                "VARIANT_LOCKED",
            );
        }
    }
}

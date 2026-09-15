import type {GenerationJob, IGenerationRepository, IGenerationService} from "./generation.types.js";
import {VariantValidator} from "../../ai/variant-validator.js";
import type {IPostRepository} from "../posts/posts.types.js";
import type {IPlatformRepository, Platform} from "../platforms/platforms.types.js";
import type {IVariantsRepository} from "../variants/variants.types.js";
import type {AiProvider} from "../../ai/ai-provider.js";
import {AppError} from "../../shared/error.js";
import {enqueueGenerationJob} from "./generation.queue.js";


export class GenerationService implements IGenerationService {
    private readonly validator = new VariantValidator();

    constructor(
        private readonly generationRepository: IGenerationRepository,
        private readonly postRepository: IPostRepository,
        private readonly platformRepository: IPlatformRepository,
        private readonly variantsRepository: IVariantsRepository,
        private readonly aiProvider: AiProvider,
    ) {}

    /**
     * Creates and queues a generation job for an existing post.
     *
     * @throws {AppError} If the post does not exist.
     */
    async createGenerationJob(postId: string): Promise<GenerationJob> {
        const post = await this.postRepository.findById(postId);

        if (!post) {
            throw AppError.notFound(`Post not found`, "POST_NOT_FOUND");
        }

        const job = await this.generationRepository.create(postId);
        await enqueueGenerationJob({
            generationJobId: job.id,
            postId
        })

        return job;
    }

    /**
     * Retrieves a generation job by ID.
     *
     * @throws {AppError} If the job does not exist.
     */
    async getGenerationJob(id: string): Promise<GenerationJob> {
        const job = await this.generationRepository.findById(id);

        if (!job) {
            throw AppError.notFound("Generation job not found", "JOB_NOT_FOUND");
        }

        return job;
    }

    /**
     * Generates and persists a variant for every enabled platform, then completes the job.
     *
     * @throws {AppError} If the post is missing or no platforms are enabled.
     */
    async processGenerationJob(jobId: string, postId: string): Promise<void> {
        await this.generationRepository.setStatusProcessing(jobId);

        const post = await this.postRepository.findById(postId);

        if (!post) {
            throw AppError.notFound(`Post not found`, "POST_NOT_FOUND");
        }

        const platforms = await this.platformRepository.listEnabled();

        if (platforms.length === 0) {
            throw AppError.badRequest("No enabled platforms found", "NO_ENABLED_PLATFORMS");
        }

        await this.ensureNothingApprovedOrPublished(postId);

        const results = await Promise.all(
            platforms.map((p) => this.generateVariantForPlatform(post.content, p))
        )

        await this.variantsRepository.upsertVariants(postId, results);

        await this.generationRepository.setStatusCompleted(jobId);
    }

    /** Generates and validates one platform variant while retaining provider metadata. */
    private async generateVariantForPlatform(postContent: string, platform: Platform) {
        const result = await this.aiProvider.generateVariant({ postContent, platform });
        this.validator.validate(result.content, platform)

        return {
            platformId: platform.id,
            content: result.content,
            provider: result.provider,
            model: result.model,

        }
    }

    private async ensureNothingApprovedOrPublished(postId: string): Promise<void> {
        const variants = await this.variantsRepository.findByPostId(postId);

        const locked = variants.find((v) => {
            v.status === "approved" || v.status === "published";
        })

        if (locked) {
            throw AppError.conflict(
                `Cannot regenerate: a variant is already ${locked.status}`,
                "VARIANT_LOCKED",
            );
        }
    }
}

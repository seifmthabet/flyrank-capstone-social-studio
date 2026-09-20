import { VariantValidator } from "../../ai/variant-validator.js";
import { AppError } from "../../shared/error.js";
import type { IPlatformRepository } from "../platforms/platforms.types.js";
import type {
    IVariantsRepository,
    IVariantsService,
    Variant,
} from "./variants.types.js";

export class VariantsService implements IVariantsService {
    private readonly validator = new VariantValidator();

    constructor(
        private readonly variantsRepository: IVariantsRepository,
        private readonly platformRepository: IPlatformRepository,
    ) {}

    async findById(variantId: string): Promise<Variant | null> {
        const variant = await this.variantsRepository.findById(variantId);
        if (!variant) {
            throw AppError.notFound("Variant not found");
        }
        return variant;
    }

    async editVariant(variantId: string, content: string): Promise<void> {
        const variant = await this.variantsRepository.findById(variantId);
        if (!variant) {
            throw AppError.notFound("Variant not found");
        }

        if (variant.status === "published") {
            throw AppError.conflict(
                "Published variants cannot be edited",
                "VARIANT_PUBLISHED",
            );
        }

        if (typeof content !== "string") {
            throw AppError.badRequest(
                "Variant content must be a string",
                "INVALID_VARIANT_CONTENT",
            );
        }

        const platform = await this.platformRepository.findById(
            variant.platformId,
        );
        if (!platform) {
            throw AppError.notFound(
                "Platform profile not found",
                "PLATFORM_NOT_FOUND",
            );
        }

        this.validator.validate(content, platform);
        await this.variantsRepository.editVariant(variantId, content);
    }

    async approveVariant(variantId: string): Promise<void> {
        const variant = await this.variantsRepository.findById(variantId);
        if (!variant) {
            throw AppError.notFound("Variant not found");
        }
        await this.variantsRepository.approveVariant(variantId);
    }

    async rejectVariant(variantId: string, reason: string): Promise<void> {
        const variant = await this.variantsRepository.findById(variantId);
        if (!variant) {
            throw AppError.notFound("Variant not found");
        }
        await this.variantsRepository.rejectVariant(variantId, reason);
    }
}

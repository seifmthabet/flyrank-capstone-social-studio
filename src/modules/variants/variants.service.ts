import { AppError } from "../../shared/error.js";
import type {
    IVariantsRepository,
    IVariantsService,
    Variant,
} from "./variants.types.js";

export class VariantsService implements IVariantsService {
    constructor(private readonly variantsRepository: IVariantsRepository) {}

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

import type { SocialPublisher } from "../../publishing/social-publisher.js";
import { AppError } from "../../shared/error.js";
import type { IPlatformRepository } from "../platforms/platforms.types.js";
import type { ISchedulesRepository } from "../schedules/schedules.types.js";
import type { IVariantsRepository } from "../variants/variants.types.js";
import type { IPublishingRepository } from "./publishing.types.js";

export type PublisherResolver = (adapterCode: string) => SocialPublisher;

export class PublishingService {
    constructor(
        private readonly schedulesRepository: ISchedulesRepository,
        private readonly variantsRepository: IVariantsRepository,
        private readonly platformsRepository: IPlatformRepository,
        private readonly publishingRepository: IPublishingRepository,
        private readonly resolvePublisher: PublisherResolver,
    ) {}

    async publishSchdule(scheduleId: string) {
        const schedule = await this.schedulesRepository.findById(scheduleId);
        if (!schedule)
            throw AppError.notFound(`Schedule not found`, "SCHEDULE_NOT_FOUND");

        if (schedule.status === "success") return null;

        const variant = await this.variantsRepository.findById(
            schedule.variantId,
        );
        if (!variant)
            throw AppError.notFound(`Variant not found`, "VARIANT_NOT_FOUND");

        const platform = await this.platformsRepository.findById(
            variant.platformId,
        );
        if (!platform)
            throw AppError.notFound(`Platform not found`, "PLATFORM_NOT_FOUND");
        if (!platform.enabled)
            throw AppError.badRequest(
                `Platform is disabled`,
                "PLATFORM_DISABLED",
            );

        const attempt = await this.publishingRepository.createAttempt({
            scheduleId: schedule.id,
            idempotencyKey: schedule.id,
        });

        const publisher = this.resolvePublisher(platform.adapter);

        const result = await publisher.publish({
            content: variant.content,
            platformCode: platform.code,
            variantId: variant.id,
            scheduleId: schedule.id,
            idempotencyKey: schedule.idempotencyKey,
        });

        await this.publishingRepository.completeAttempt(attempt.id, {
            status: result.success ? "success" : "failed",
            externalPostId: result.externalPostId ?? null,
            response: result.response ?? null,
            error: result.error ?? null,
        });

        if (result.success) {
            await this.schedulesRepository.markStatus(schedule.id, "success");
            // await this.variantsRepository
        } else {
            await this.schedulesRepository.markStatus(
                schedule.id,
                "failed",
                result.error ?? null,
            );
        }

        return result;
    }
}

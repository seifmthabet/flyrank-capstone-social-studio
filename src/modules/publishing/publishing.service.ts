import type { SocialPublisher } from "../../publishing/social-publisher.js";
import { AppError } from "../../shared/error.js";
import type { IPlatformRepository } from "../platforms/platforms.types.js";
import type { ISchedulesRepository } from "../schedules/schedules.types.js";
import type { IVariantsRepository } from "../variants/variants.types.js";
import type { IPublishingRepository } from "./publishing.types.js";

export type PublisherResolver = (adapterCode: string) => SocialPublisher;

export class PublishingService {
    constructor(
        private readonly schdulesRepository: ISchedulesRepository,
        private readonly variantsRepository: IVariantsRepository,
        private readonly platformsRepository: IPlatformRepository,
        private readonly publishingRepository: IPublishingRepository,
        private readonly resolvePublisher: PublisherResolver,
    ) {}

    async publishSchdule(jobId: string, scheduleId: string) {
        const job = await this.publishingRepository.findById(jobId);

        if (!job) {
            throw AppError.notFound(
                `Publishing job ${jobId} not found`,
                "JOB_NOT_FOUND",
            );
        }

        if (job.status === "success") {
            return;
        }

        const schedule =
            await this.schdulesRepository.findScheduleById(scheduleId);
        if (!schedule) {
            throw AppError.notFound(`Schedule with ID ${scheduleId} not found`);
        }

        const variant = await this.variantsRepository.findById(
            schedule.variantId,
        );

        const platforms = await this.platformsRepository.listEnabled();

        platforms.forEach(async (platform) => {
            const publisher = this.resolvePublisher(platform.code);

            publisher.publish({
                content: variant?.content || "",
                platformCode: platform.code,
                variantId: variant?.id || "",
                scheduleId: schedule.id,
                idempotencyKey: schedule.idempotencyKey,
            });
        });

        await this.publishingRepository.createAttempt({
            scheduleId: schedule.id,
            idempotencyKey: schedule.idempotencyKey,
        });
    }
}

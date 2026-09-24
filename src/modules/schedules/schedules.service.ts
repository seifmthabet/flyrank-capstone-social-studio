import { createHash } from "node:crypto";
import { AppError } from "../../shared/error.js";
import type { IVariantsRepository } from "../variants/variants.types.js";
import type {
    CreateScheduleResult,
    EnqueuePublishJob,
    ISchedulesRepository,
    ISchedulesService,
    Schedule,
} from "./schedules.types.js";

export class SchedulesService implements ISchedulesService {
    constructor(
        private readonly schedulesRepository: ISchedulesRepository,
        private readonly VariantsRepository: IVariantsRepository,
        private readonly enqueuePublishJob: EnqueuePublishJob,
    ) {}

    async createSchedule(input: {
        variantId: string;
        scheduledAt: Date;
    }): Promise<CreateScheduleResult> {
        const variant = await this.VariantsRepository.findById(input.variantId);

        if (!variant) {
            throw AppError.notFound("Variant not found", "VARIANT_NOT_FOUND");
        }

        if (variant.status !== "approved") {
            throw AppError.conflict(
                "Variant must be approved before scheduling",
                "VARIANT_NOT_APPROVED",
            );
        }

        const scheduledAt = new Date(input.scheduledAt);
        const idempotencyKey = createHash("sha256")
            .update(`${input.variantId}:${scheduledAt.toISOString()}`)
            .digest("hex");

        const { schedule, created } = await this.schedulesRepository.create(
            input.variantId,
            scheduledAt,
            idempotencyKey,
        );

        if (created) {
            await this.enqueuePublishJob({
                scheduleId: schedule.id,
                variantId: schedule.variantId,
                scheduledAt: schedule.scheduledAt,
                idempotencyKey: schedule.idempotencyKey,
            });
        }

        return { schedule, created };
    }

    async getSchedule(scheduleId: string): Promise<Schedule> {
        const schedule = await this.schedulesRepository.findById(scheduleId);
        if (!schedule) {
            throw AppError.notFound("Schedule not found", "SCHEDULE_NOT_FOUND");
        }
        return schedule;
    }
}

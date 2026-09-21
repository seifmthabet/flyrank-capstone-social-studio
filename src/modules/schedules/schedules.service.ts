import { AppError } from "../../shared/error.js";
import type {
    ISchedulesRepository,
    ISchedulesService,
    Schedule,
} from "./schedules.types.js";

export class SchedulesService implements ISchedulesService {
    constructor(
        private readonly schedulesRepository: ISchedulesRepository,
    ) {}

    async scheduleVariant(
        variantId: string,
        scheduledAt: Date,
    ): Promise<Schedule> {
        if (scheduledAt < new Date()) {
            throw AppError.badRequest("Scheduled time must be in the future");
        }

        const idempotencyKey = `${variantId}-${scheduledAt.getTime()}`;

        const schedule = await this.schedulesRepository.createSchedule({
            variantId,
            scheduledAt,
            idempotencyKey,
        });

        return schedule;
    }

    async getScheduleById(id: string): Promise<Schedule | null> {
        return this.schedulesRepository.findScheduleById(id);
    }

    async getSchedulesByVariantId(variantId: string): Promise<Schedule[]> {
        return this.schedulesRepository.findSchedulesByVariantId(variantId);
    }

    async getPendingSchedules(): Promise<Schedule[]> {
        return this.schedulesRepository.findPendingSchedules();
    }

    async updateSchedule(
        id: string,
        input: Partial<Omit<Schedule, "id" | "variantId" | "createdAt" | "updatedAt">>,
    ): Promise<void> {
        await this.schedulesRepository.updateSchedule(id, input);
    }
}

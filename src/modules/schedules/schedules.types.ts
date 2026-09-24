export type ScheduleStatus = "pending" | "processing" | "success" |"failed";

export interface Schedule {
    id: string;
    variantId: string;
    scheduledAt: Date;
    status: ScheduleStatus;
    idempotencyKey: string;
    attemptCount: number;
    lastError: string | null;
    lockedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
}

export interface CreateScheduleResult {
    schedule: Schedule;
    created: boolean;
}

export interface EnqueuePublishJob {
    (data: {
        scheduleId: string;
        variantId: string;
        scheduledAt: Date;
        idempotencyKey: string;
    }) : Promise<void>;
}

export interface ISchedulesRepository {
    create(
        variantId: string,
        scheduledAt: Date,
        idempotencyKey: string,
    ): Promise<CreateScheduleResult>;

    findById(scheduleId: string): Promise<Schedule | null>;
}

export interface ISchedulesService {
    createSchedule(input: { variantId: string; scheduledAt: Date }): Promise<CreateScheduleResult>;
    getSchedule(scheduleId: string): Promise<Schedule>;
}
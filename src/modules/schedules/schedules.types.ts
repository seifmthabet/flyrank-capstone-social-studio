

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

export interface ISchedulesRepository {
    createSchedule(input: {
        variantId: string;
        scheduledAt: Date;
        idempotencyKey: string;
    }): Promise<Schedule>;
    findScheduleById(id: string): Promise<Schedule | null>;
    findSchedulesByVariantId(variantId: string): Promise<Schedule[]>;
    findPendingSchedules(): Promise<Schedule[]>;
    updateSchedule(
        id: string,
        input: Partial<Omit<Schedule, "id" | "variantId" | "createdAt" | "updatedAt">>,
    ): Promise<void>;
}

export interface ISchedulesService {
    scheduleVariant(variantId: string, scheduledAt: Date): Promise<Schedule>;
    getScheduleById(id: string): Promise<Schedule | null>;
    getSchedulesByVariantId(variantId: string): Promise<Schedule[]>;
    getPendingSchedules(): Promise<Schedule[]>;
    updateSchedule(
        id: string,
        input: Partial<Omit<Schedule, "id" | "variantId" | "createdAt" | "updatedAt">>,
    ): Promise<void>;
}
export type AttemptStatus = "started" | "success" | "failed";

export interface PublishingAttempt {
    id: string;
    scheduleId: string;
    attemptNumber: number;
    idempotencyKey: string;
    status: AttemptStatus;
    startedAt: Date;
    completedAt: Date | null;
    externalPostId: string | null;
    response: unknown | null;
    error: string | null;
}

export interface IPublishingRepository {
    createAttempt(input: { scheduleId: string; idempotencyKey: string }): Promise<PublishingAttempt>;
    completeAttempt(id: string, input: {
        status: Exclude<AttemptStatus, "started">;
        externalPostId?: string | null;
        response?: unknown;
        error?: string | null;
    }): Promise<void>;
    findAttemptsByScheduleId(scheduleId: string): Promise<PublishingAttempt[]>;
}
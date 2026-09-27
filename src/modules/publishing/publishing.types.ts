import type { PoolClient } from "pg";

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
    createAttempt(
        client: PoolClient,
        input: { scheduleId: string; idempotencyKey: string },
    ): Promise<PublishingAttempt>;
    completeAttempt(
        client: PoolClient,
        id: string,
        input: {
            status: Exclude<AttemptStatus, "started">;
            externalPostId?: string | null;
            response?: unknown;
            error?: string | null;
        },
    ): Promise<void>;
    findSuccessAttempt(
        client: PoolClient,
        scheduleId: string,
    ): Promise<PublishingAttempt | null>;
    findAttemptsByScheduleId(scheduleId: string): Promise<PublishingAttempt[]>;
}

export interface IPublishingService {
    getAttemptsByScheduleId(scheduleId: string): Promise<PublishingAttempt[]>;
}

export interface PublishingJobData {
    scheduledId: string;
}

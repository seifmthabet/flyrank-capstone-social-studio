import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../shared/error.js";
import type { IVariantsRepository } from "../variants/variants.types.js";
import { scheduleInputSchema } from "./schedules.schema.js";
import { SchedulesService } from "./schedules.service.js";
import type { ISchedulesRepository, Schedule } from "./schedules.types.js";

const variantId = "00000000-0000-4000-8000-000000000001";
const scheduledAt = new Date("2030-01-01T12:00:00.000Z");

const schedule = (idempotencyKey: string): Schedule => ({
    id: "00000000-0000-4000-8000-000000000002",
    variantId,
    scheduledAt,
    status: "pending",
    idempotencyKey,
    attemptCount: 0,
    lastError: null,
    lockedAt: null,
    createdAt: scheduledAt,
    updatedAt: scheduledAt,
    completedAt: null,
});

test("schedule payload accepts only a future ISO scheduledAt", () => {
    assert.equal(
        scheduleInputSchema.safeParse({
            scheduledAt: "2030-01-01T12:00:00.000Z",
        }).success,
        true,
    );
    assert.equal(
        scheduleInputSchema.safeParse({
            scheduledAt: "2020-01-01T12:00:00.000Z",
        }).success,
        false,
    );
});

test("creates an approved schedule with the canonical idempotency key", async () => {
    let capturedKey: string | undefined;
    const schedulesRepository = {
        create: async (_id: string, _at: Date, key: string) => {
            capturedKey = key;
            return { schedule: schedule(key), created: true };
        },
    } as unknown as ISchedulesRepository;
    const variantsRepository = {
        findById: async () => ({ status: "approved" }),
    } as unknown as IVariantsRepository;

    const service = new SchedulesService(
        schedulesRepository,
        variantsRepository,
        async () => undefined,
    );

    const result = await service.createSchedule({ variantId, scheduledAt });

    assert.equal(result.created, true);
    assert.equal(
        capturedKey,
        "8d8ff8a2266d1efb7890dbb3e4d3ad43998e9ebd5c0cf0598831c30a967737a3",
    );
});

test("does not insert a schedule for an unapproved variant", async () => {
    let createCalled = false;
    const schedulesRepository = {
        create: async () => {
            createCalled = true;
            throw new Error("must not insert");
        },
    } as unknown as ISchedulesRepository;
    const variantsRepository = {
        findById: async () => ({ status: "draft" }),
    } as unknown as IVariantsRepository;
    const service = new SchedulesService(
        schedulesRepository,
        variantsRepository,
        async () => undefined,
    );

    await assert.rejects(
        () => service.createSchedule({ variantId, scheduledAt }),
        (error: unknown) =>
            error instanceof AppError && error.code === "VARIANT_NOT_APPROVED",
    );
    assert.equal(createCalled, false);
});

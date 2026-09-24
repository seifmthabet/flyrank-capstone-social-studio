import type { PoolClient } from "pg";
import { dbTransaction } from "../../database/db.js";
import type {
    PublisherResult,
    SocialPublisher,
} from "../../publishing/social-publisher.js";
import { AppError } from "../../shared/error.js";
import type { IPlatformRepository } from "../platforms/platforms.types.js";
import type { ISchedulesRepository } from "../schedules/schedules.types.js";
import type { IVariantsRepository } from "../variants/variants.types.js";
import type { IPublishingRepository } from "./publishing.types.js";

export type PublisherResolver = (adapterCode: string) => SocialPublisher;
type TransactionRunner = <T>(
    fn: (client: PoolClient) => Promise<T>,
) => Promise<T>;

const MAX_PUBLISH_ATTEMPTS = 5;

export class PublishingService {
    constructor(
        private readonly schedulesRepository: ISchedulesRepository,
        private readonly variantsRepository: IVariantsRepository,
        private readonly platformsRepository: IPlatformRepository,
        private readonly publishingRepository: IPublishingRepository,
        private readonly resolvePublisher: PublisherResolver,
        private readonly transaction: TransactionRunner = dbTransaction,
    ) {}

    async publishSchdule(scheduleId: string) {
        const claim = await this.transaction(async (client) => {
            const priorSuccess =
                await this.publishingRepository.findSuccessAttempt(
                    client,
                    scheduleId,
                );
            if (priorSuccess) {
                await this.schedulesRepository.markStatus(
                    client,
                    scheduleId,
                    "success",
                );
                return { kind: "already-success", priorSuccess } as const;
            }

            const claimed = await this.schedulesRepository.claim(
                client,
                scheduleId,
            );
            if (!claimed) {
                return { kind: "not-claimable" } as const;
            }

            const attempt = await this.publishingRepository.createAttempt(
                client,
                {
                    scheduleId: scheduleId,
                    idempotencyKey: claimed.idempotencyKey,
                },
            );
            return { kind: "claimed", claimed, attempt } as const;
        });

        if (claim.kind === "already-success") {
            const stored: PublisherResult = {
                success: true,
            };
            if (claim.priorSuccess.externalPostId)
                stored.externalPostId = claim.priorSuccess.externalPostId;
            if (claim.priorSuccess.response !== null)
                stored.response = claim.priorSuccess.response;
            return stored;
        }

        if (claim.kind === "not-claimable") {
            return null;
        }

        const { claimed, attempt } = claim;

        const variant = await this.variantsRepository.findById(
            claimed.variantId,
        );
        if (!variant)
            throw AppError.notFound("Variant not found", "VARIANT_NOT_FOUND");
        const platform = await this.platformsRepository.findById(
            variant.platformId,
        );
        if (!platform?.enabled)
            throw AppError.conflict(
                "Platform not enabled",
                "PLATFORM_DISABLED",
            );

        let result: PublisherResult;

        try {
            result = await this.resolvePublisher(platform.code).publish({
                content: variant.content,
                platformCode: platform.code,
                variantId: variant.id,
                scheduleId: claimed.id,
                idempotencyKey: claimed.idempotencyKey,
            });
        } catch (thrown) {
            await this.transaction(async (client) => {
                await this.publishingRepository.completeAttempt(
                    client,
                    attempt.id,
                    {
                        status: "failed",
                        error:
                            thrown instanceof Error
                                ? thrown.message
                                : "Unknown publish error",
                    },
                );
                await this.schedulesRepository.markStatus(
                    client,
                    claimed.id,
                    "pending",
                    thrown instanceof Error
                        ? thrown.message
                        : "Unknown publish error",
                );
            });
            throw thrown;
        }

        if (result.success) {
            await this.transaction(async (client) => {
                await this.publishingRepository.completeAttempt(
                    client,
                    attempt.id,
                    {
                        status: "success",
                        externalPostId: result.externalPostId ?? null,
                        response: result.response ?? null,
                    },
                );
                await this.schedulesRepository.markStatus(
                    client,
                    claimed.id,
                    "success",
                );
                await this.variantsRepository.markPublished(client, variant.id);
            });
        } else {
            const terminal = claimed.attemptCount >= MAX_PUBLISH_ATTEMPTS;
            await this.transaction(async (client) => {
                await this.publishingRepository.completeAttempt(
                    client,
                    attempt.id,
                    {
                        status: "failed",
                        error: result.error ?? "Publish failed",
                    },
                );
                await this.schedulesRepository.markStatus(
                    client,
                    claimed.id,
                    terminal ? "failed" : "pending",
                    result.error ?? "Publish failed",
                );
            });
        }

        return result;
    }
}

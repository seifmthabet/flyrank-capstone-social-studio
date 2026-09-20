import { enqueueGenerationJob } from "./generation.queue.js";
import type { IGenerationRepository } from "./generation.types.js";

const STALE_LEASE_SECONDS = 300;
const MAX_ATTEMPTS = 3;

export const recoverStaleGenerationJobs = async (
    generationRepository: IGenerationRepository,
): Promise<void> => {
    const requeued = await generationRepository.reclaimStaleProcessing(
        STALE_LEASE_SECONDS,
        MAX_ATTEMPTS,
    );

    for (const job of requeued) {
        try {
            await enqueueGenerationJob({
                generationJobId: job.id,
                postId: job.postId,
            });
        } catch (error) {
            console.error(
                `Failed to re-enqueue generation job ${job.id}:`,
                error,
            );
        }
    }

    if (requeued.length > 0) {
        console.log(`Re-enqueued ${requeued.length} stale generation job(s).`);
    }
};

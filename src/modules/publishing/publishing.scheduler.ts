import type { ISchedulesRepository } from "../schedules/schedules.types.js";
import { enqueuePublishingJob } from "./publishing.queue.js";

const STALE_LEASE_SECONDS = 300;
const MAX_ATTEMPTS = Math.max(5, 1);

export const sweepDueSchedules = async (
    schedulesRepository: ISchedulesRepository,
): Promise<void> => {
    const reclaimed = await schedulesRepository.reclaimStaleProcessing(
        STALE_LEASE_SECONDS,
        MAX_ATTEMPTS,
    );

    const due = await schedulesRepository.findDuePending(new Date());
    for (const schedule of due) {
        try {
            await enqueuePublishingJob({
                scheduleId: schedule.id,
                scheduledAt: schedule.scheduledAt,
            });
        } catch (error) {
            console.error(
                `Failed to enqueue publishing job for schedule ${schedule.id}:`,
                error,
            );
        }
    }

    if (reclaimed.length > 0 || due.length > 0) {
        console.log(
            `Sweep: reclaimed ${reclaimed.length}, enqueued ${due.length} schedule(s)`,
        );
    }
};

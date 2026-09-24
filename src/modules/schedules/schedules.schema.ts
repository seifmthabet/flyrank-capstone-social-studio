import { z } from "zod";

export const scheduleInputSchema = z
    .object({
        variantId: z.string().uuid(),
        scheduledAt: z.string().datetime({ offset: true }),
    })
    .refine(({ scheduledAt }) => Date.parse(scheduledAt) > Date.now(), {
        message: "scheduledAt must be a future date",
        path: ["scheduledAt"],
    });

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

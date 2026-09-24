import { type Request, type Response, Router } from "express";
import { AppError } from "../../shared/error.js";
import { scheduleInputSchema } from "../schedules/schedules.schema.js";
import type { ISchedulesService } from "../schedules/schedules.types.js";
import type { IVariantsService } from "./variants.types.js";

export const createVariantsRoute = (deps: {
    variantsService: IVariantsService;
    schedulesService: ISchedulesService;
}) => {
    const variantsRouter = Router();

    variantsRouter.get("/:id", async (req: Request, res: Response) => {
        const variant = await deps.variantsService.findById(
            String(req.params.id),
        );
        res.status(200).json({ data: variant });
    });

    variantsRouter.put("/:id", async (req: Request, res: Response) => {
        const { content } = req.body;
        await deps.variantsService.editVariant(String(req.params.id), content);
        res.status(200).json({ message: "Variant updated successfully" });
    });

    variantsRouter.post("/:id/approve", async (req: Request, res: Response) => {
        await deps.variantsService.approveVariant(String(req.params.id));
        res.status(200).json({ message: "Variant approved successfully" });
    });

    variantsRouter.post("/:id/reject", async (req: Request, res: Response) => {
        const { reason } = req.body;
        await deps.variantsService.rejectVariant(String(req.params.id), reason);
        res.status(200).json({ message: "Variant rejected successfully" });
    });

    variantsRouter.post(
        "/:id/schedule",
        async (req: Request, res: Response) => {
            const parsed = scheduleInputSchema.safeParse(req.body);

            if (!parsed.success) {
                throw AppError.badRequest(
                    `Invalid schedule payload: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
                    "INVALID_SCHEDULE_PAYLOAD",
                    parsed.error.issues.map((i) => ({
                        path: i.path.join("."),
                        message: i.message,
                    })),
                );
            }

            const { schedule, created } =
                await deps.schedulesService.createSchedule({
                    ...parsed.data,
                    scheduledAt: new Date(parsed.data.scheduledAt),
                });

            res.status(created ? 201 : 200).json({ data: schedule, created });
        },
    );

    return variantsRouter;
};

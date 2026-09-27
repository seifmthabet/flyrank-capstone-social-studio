import { type Request, type Response, Router } from "express";
import type { IPublishingService } from "../publishing/publishing.types.js";
import type { ISchedulesService } from "./schedules.types.js";

export const createSchedulesRoute = (deps: {
    schedulesService: ISchedulesService;
    publishingService: IPublishingService;
}) => {
    const schedulesRouter = Router();

    schedulesRouter.get("/:id", async (req: Request, res: Response) => {
        const schedule = await deps.schedulesService.getSchedule(
            String(req.params.id),
        );
        res.status(200).json({ data: schedule });
    });

    schedulesRouter.get("/", async (_req: Request, res: Response) => {
        const schedules = await deps.schedulesService.getSchedules();
        res.status(200).json({ data: schedules });
    });

    schedulesRouter.get(
        "/:id/attempts",
        async (req: Request, res: Response) => {
            const attempts =
                await deps.publishingService.getAttemptsByScheduleId(
                    String(req.params.id),
                );
            res.status(200).json({ data: attempts });
        },
    );

    return schedulesRouter;
};

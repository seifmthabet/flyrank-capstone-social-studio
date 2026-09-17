import { type Request, type Response, Router } from "express";
import type { IGenerationService } from "./generation.types.js";

export const createGenerationRoute = (deps: {
    generationService: IGenerationService;
}) => {
    const generationRouter = Router();

    generationRouter.post(
        "/posts/:id/generate",
        async (req: Request, res: Response) => {
            const job = await deps.generationService.createGenerationJob(
                String(req.params.id),
            );
            res.status(201).json({
                data: job,
            });
        },
    );

    generationRouter.get(
        "/generation/:id",
        async (req: Request, res: Response) => {
            const job = await deps.generationService.getGenerationJob(
                String(req.params.id),
            );
            res.status(200).json({ data: job });
        },
    );

    generationRouter.get(
        "/posts/:id/variants",
        async (req: Request, res: Response) => {
            const variants = await deps.generationService.getGenerationVariants(
                String(req.params.id),
            );
            res.status(200).json({ data: variants });
        },
    );

    return generationRouter;
};

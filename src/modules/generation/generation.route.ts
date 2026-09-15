import type {IGenerationService} from "./generation.types.js";
import { Router, type Request, type Response } from "express";


/** Creates routes for starting generation and retrieving generation-job state. */
export const createGenerationRoute = (deps: { generationService: IGenerationService }) => {
    const generationRouter = Router();

    generationRouter.post('/posts/:id/generate', async (req: Request, res: Response) => {
        const job = await deps.generationService.createGenerationJob(String(req.params.id));
        res.status(201).json({
            data: job
        });
    })

    generationRouter.get("/generation/:id", async (req: Request, res: Response) => {
        const job = await deps.generationService.getGenerationJob(String(req.params.id));
        res.status(200).json({ data: job });
    });

    return generationRouter;
}

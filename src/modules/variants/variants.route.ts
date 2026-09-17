import { type Request, type Response, Router } from "express";
import type { IVariantsService } from "./variants.types.js";

export const createVariantsRoute = (deps: {
    variantsService: IVariantsService;
}) => {
    const variantsRouter = Router();

    variantsRouter.get("/:id", async (req: Request, res: Response) => {
        const variant = await deps.variantsService.findById(
            String(req.params.id),
        );
        res.status(200).json({ data: variant });
    });

    variantsRouter.patch("/:id", async (req: Request, res: Response) => {
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
            // const { scheduleTime } = req.body;
            const post = await deps.variantsService.findById(
                String(req.params.id),
            );
            if (post?.status !== "approved") {
                res.status(409).json({
                    message: "Variant must be approved before scheduling",
                });
            }
        },
    );

    return variantsRouter;
};

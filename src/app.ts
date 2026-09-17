import express from "express";
import {
    createGenerationContainer,
    createPostContainer,
    createVariantsContainer,
} from "./config/container.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { createGenerationRoute } from "./modules/generation/generation.route.js";
import { createPostsRoute } from "./modules/posts/posts.route.js";
import { createVariantsRoute } from "./modules/variants/variants.route.js";

const app = express();

const { postService } = createPostContainer();
const { generationService } = createGenerationContainer();
const { variantsService } = createVariantsContainer();

app.use(express.json());

app.use("/api/posts", createPostsRoute({ postService }));
app.use("/api", createGenerationRoute({ generationService }));
app.use("/api/variants", createVariantsRoute({ variantsService }));

app.use(errorHandler);

app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
    });
});

export default app;

import express  from "express"
import postsRouter from "./modules/posts/posts.route.js";
import {errorHandler} from "./middlewares/error-handler.js";
import {createGenerationRoute} from "./modules/generation/generation.route.js";
import {GenerationService} from "./modules/generation/generation.service.js";
import {createGenerationContainer} from "./config/container.js";

const app = express()

const { generationService } = createGenerationContainer();

app.use(express.json())

app.use("/api/posts", postsRouter);
app.use("/api", createGenerationRoute({ generationService }))

app.use(errorHandler)


app.get("/health", (req, res) => {
    res.status(200).json(
        {
            status: "ok"
        }
    )
})

export default app
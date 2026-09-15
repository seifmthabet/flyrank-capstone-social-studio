import express  from "express"
import postsRouter from "./modules/posts/posts.route.js";
import {errorHandler} from "./middlewares/error-handler.js";

const app = express()

app.use(express.json())
app.use(errorHandler)

app.get("/health", (req, res) => {
    res.status(200).json(
        {
            status: "ok"
        }
    )
})

app.use("/api/posts", postsRouter);

export default app
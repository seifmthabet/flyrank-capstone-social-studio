import express  from "express"
import postsRouter from "./modules/posts/posts.route.js";

const app = express()

app.use(express.json())

app.get("/health", (req, res) => {
    res.status(200).json(
        {
            status: "ok"
        }
    )
})

app.use("/api/posts", postsRouter);

export default app
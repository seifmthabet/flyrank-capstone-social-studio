import app from "./app.js"
import {env} from "./config/env.js";

const PORT = env.api.port;

const start = async (): Promise<void> => {
    app.listen(PORT, () => {
        console.log(
            `Server running on http://localhost:${PORT}`
        );
    });
};

start();
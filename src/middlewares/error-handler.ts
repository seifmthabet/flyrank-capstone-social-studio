import type { Request, Response, NextFunction } from "express";
import {AppError} from "../shared/error.js";

/**
 * Serializes `AppError` instances and hides unexpected error details behind a 500 response.
 * Unexpected errors are also written to the error log.
 */
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof AppError) {
        res.status(err.status).json({
            error: {
                code: err.code,
                message: err.message,
                ...(err.details === "undefined" ? {} : {details: err.details})
            }
        })
        return;
    }
    console.error(err);
    res.status(500).json({
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error"
        }
    })
}

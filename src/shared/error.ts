export class AppError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details: unknown | undefined;

    constructor(status: number, code: string, message: string, details?: unknown) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    static notFound (message: string, code="NOT_FOUND") {
        return new AppError(404, code, message);
    }

    static badRequest (message: string, code="BAD_REQUEST", details?: unknown) {
        return new AppError(400, code, message, details);
    }

    static conflict (message: string, code="CONFLICT", details?: unknown) {
        return new AppError(409, code, message, details);
    }

    static internal (message: string, code="INTERNAL_ERROR", details?: unknown) {
        return new AppError(500, code, message, details);
    }
}
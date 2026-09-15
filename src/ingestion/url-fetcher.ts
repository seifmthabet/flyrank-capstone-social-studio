import {AppError} from "../shared/error.js";

export class UrlFetcher {
    constructor() {}
    async fetch(url: string): Promise<string> {
        const response = await fetch(url, {
            method: "GET",
            signal: AbortSignal.timeout(10000),
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
            }
        });

        if (!response.ok) {
            throw AppError.badRequest("Failed to fetch URL: ", response.status.toString(), response.statusText);
        }

        return response.text();
    }
}
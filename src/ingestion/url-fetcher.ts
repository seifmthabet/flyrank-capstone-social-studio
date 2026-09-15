
export class UrlFetcher {
    constructor() {}
    /**
     * Fetches a URL and returns its response body as text.
     *
     * @throws {Error} If the response has a non-success status.
     */
    async fetch(url: string): Promise<string> {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Failed to fetch URL: ${response.status} ${response.statusText}`,
            );
        }

        return response.text();
    }
}

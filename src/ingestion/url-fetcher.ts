
export class UrlFetcher {
    constructor() {}
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
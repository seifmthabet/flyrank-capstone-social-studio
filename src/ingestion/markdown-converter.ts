import TurndownService from "turndown";

export class MarkdownConverter {
    private readonly turndown: TurndownService;

    constructor() {
        this.turndown = new TurndownService({
            headingStyle: "atx",
            bulletListMarker: "-",
            codeBlockStyle: "fenced",
        });
    }

    convert(html: string): string {
        return this.turndown.turndown(html).trim();
    }
}

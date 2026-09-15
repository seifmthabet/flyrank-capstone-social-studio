import TurndownService from "turndown";


export class MarkdownConverter {
    private readonly turndown: TurndownService;

    constructor() {
        this.turndown = new TurndownService({
            headingStyle: "atx",
            bulletListMarker: "-",
            codeBlockStyle: "fenced",
        })
    }

    /** Converts HTML to trimmed Markdown using ATX headings and fenced code blocks. */
    convert(html: string): string {
        return this.turndown.turndown(html).trim();
    }
}

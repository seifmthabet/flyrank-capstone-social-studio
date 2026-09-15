import {JSDOM} from "jsdom";
import {Readability} from "@mozilla/readability";

interface ExtractArticle {
    title: string | null;
    content: string;
    excerpt: string | null;
    byline: string | null;
    siteName: string | null;
}

export class ArticleExtractor {
    constructor() {}
    /**
     * Extracts article metadata and HTML content from a document.
     *
     * The URL establishes the document base URL used while parsing the HTML.
     *
     * @throws {Error} If Readability cannot identify an article.
     */
    extract(html: string, url: string) : ExtractArticle {
        const dom = new JSDOM(html, {
            url
        });

        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (!article) {
            throw new Error("Failed to parse article");
        }

        return {
            title: article.title ?? null,
            content: article.content ?? "",
            excerpt: article.excerpt ?? null,
            byline: article.byline ?? null,
            siteName: article.siteName ?? null,
        }

    }
}

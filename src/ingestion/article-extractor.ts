import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { AppError } from "../shared/error.js";

interface ExtractArticle {
    title: string | null;
    content: string;
    excerpt: string | null;
    byline: string | null;
    siteName: string | null;
}

export class ArticleExtractor {
    extract(html: string, url: string): ExtractArticle {
        const dom = new JSDOM(html, {
            url,
        });

        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (!article) {
            throw AppError.badRequest("Failed to parse article");
        }

        return {
            title: article.title ?? null,
            content: article.content ?? "",
            excerpt: article.excerpt ?? null,
            byline: article.byline ?? null,
            siteName: article.siteName ?? null,
        };
    }
}

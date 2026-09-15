import {AppError} from "../shared/error.js";
import type {PlatformConstraints} from "./ai-provider.js";

/** Counts hashtags composed of Unicode letters, digits, or underscores. */
export const countHashtags = (content: string): number =>
    content.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;

export class VariantValidator {
    /**
     * Checks generated content against the platform's content and hashtag limits.
     *
     * @throws {AppError} If the content is blank, too long, or contains too many hashtags.
     */
    validate(content: string, platform: PlatformConstraints): void {
        if (!content.trim()) {
            throw AppError.badRequest("Generated variant is empty", "EMPTY_VARIANT");
        }

        if (content.length > platform.maxLength) {
            throw AppError.badRequest(
                `Variant exceeds max length of ${platform.maxLength} (got ${content.length})`,
                "VARIANT_TOO_LONG",
            );
        }

        const hashtags = countHashtags(content);

        if (hashtags > platform.maxHashtags) {
            throw AppError.badRequest(
                `Variant uses ${hashtags} hashtags (max ${platform.maxHashtags})`,
                "TOO_MANY_HASHTAGS",
            );
        }
    }
}

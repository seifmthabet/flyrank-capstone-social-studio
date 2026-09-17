import { env } from "../../config/env.js";
import type {
    PublisherInput,
    PublisherResult,
    SocialPublisher,
} from "../social-publisher.js";

export class TelegramPublisher implements SocialPublisher {
    async publish(input: PublisherInput): Promise<PublisherResult> {
        if (!env.telegram.bot_token || !env.telegram.chat_id) {
            return {
                success: false,
                error: "Telegram bot token or chat ID is missing",
            };
        }

        const url = `https://api.telegram.org/bot${env.telegram.bot_token}/sendMessage`;
        const payload = {
            chat_id: env.telegram.chat_id,
            text: input.content,
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = (await response.json()) as Record<string, unknown>;

        if (!response.ok) {
            return {
                success: false,
                error: `Telegram API error: ${response.status} ${response.statusText}`,
                response: data,
            };
        }

        return {
            success: true,
            externalPostId: String(
                (data.result as { message_id?: number })?.message_id,
            ),
            response: data,
        };
    }
}

import {OpenAI} from "openai";
import {env} from "../config/env.js";
import type {Post} from "../modules/posts/posts.schema.js";
import {generatePrompt} from "./prompts.js";
import {z} from "zod";
import {AppError} from "../shared/error.js";
import type {AiProvider, GenerateVariantInput, GenerateVariantResult} from "./ai-provider.js";

export interface Platform {
    name: string;
    maxLength: number;
    tone: string;
    maxHashtags: number;
}

const aiResponseSchema = z.object({
    content: z.string(),
})

export class GroqAiProvider implements AiProvider {
    private client: OpenAI | undefined;

    constructor(private readonly model: string) {}

    private getClient(): OpenAI {
        if (!env.ai.api_key) {
            throw AppError.badRequest("GROQ_API_KEY is not configured", "AI_NOT_CONFIGURED");
        }

        this.client ??= new OpenAI({
            apiKey: env.ai.api_key,
            baseURL: env.ai.base_url,
        });

        return this.client;

    }
    /**
     * Generates a platform-specific variant and parses the provider's JSON response.
     *
     * @throws {AppError} If the provider returns no content or content with an invalid shape.
     * @throws {SyntaxError} If the provider response is not valid JSON.
     */
    async  generateVariant(input: GenerateVariantInput): Promise<GenerateVariantResult> {
        const { system, user } = generatePrompt(input);

        const completion = await this.getClient().chat.completions.create({
            model: this.model,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            temperature: 0.7,
        })

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw AppError.badRequest("AI did not return any content", "AI_NO_CONTENT");
        }

        const parsed = aiResponseSchema.safeParse(JSON.parse(content));
        if (!parsed.success) {
            throw AppError.badRequest(
                "AI provider returned an unparseable variant",
                "AI_INVALID_RESPONSE",
                parsed.error.flatten(),
                );
        }

        return {
            content: parsed.data.content,
            provider: "groq",
            model: this.model,
        }

    }
}

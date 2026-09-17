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

    private stripCodeFences(text: string): string {
        const trimmed = text.trim();
        const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
        return fenced?.[1]?.trim() ?? trimmed;
    }
    async  generateVariant(input: GenerateVariantInput): Promise<GenerateVariantResult> {
        const { system, user } = generatePrompt(input);

        const completion = await this.getClient().chat.completions.create({
            model: this.model,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
        })

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw AppError.badRequest("AI did not return any content", "AI_NO_CONTENT");
        }

        let raw: unknown;
        try {
            raw = JSON.parse(this.stripCodeFences(content));
        } catch (error) {
            throw AppError.badRequest("AI provider returned output that is not valid JSON", "AI_INVALID_RESPONSE");
        }

        const parsed = aiResponseSchema.safeParse(raw);
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

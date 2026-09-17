import type { GenerateVariantInput } from "./ai-provider.js";

export interface Prompt {
    system: string;
    user: string;
}

export const generatePrompt = (input: GenerateVariantInput) => {
    const { postContent, platform } = input;
    const system = [
        `You are a professional social media copywriter for ${platform.name}.`,
        "Obey the platform's constraints strictly.",
        `- Max length: ${platform.maxLength} characters.`,
        `- Tone: ${platform.tone}.`,
        `- Max hashtags: ${platform.maxHashtags}.`,
        `Respond with ONLY a JSON object in this exact shape: {"content": "your variant text here"}.`,
        `Do not wrap the JSON in Markdown code fences.`,
        `Do not add any text before or after the JSON.`,
    ].join("\n");

    return {
        system,
        user: `Source article:\n\n${postContent}\n\nGenerate the platform variant now.`,
    };
};

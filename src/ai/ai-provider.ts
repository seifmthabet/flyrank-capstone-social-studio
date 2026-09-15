export interface PlatformConstraints {
    id: string;
    code: string;
    name: string;
    maxLength: number;
    tone: string;
    maxHashtags: number;
}

export interface GenerateVariantInput {
    postContent: string;
    platform: PlatformConstraints;
}

export interface GenerateVariantResult {
    content: string;
    provider: string;
    model: string;
}

export interface AiProvider {
    generateVariant(input: GenerateVariantInput): Promise<GenerateVariantResult>;
}
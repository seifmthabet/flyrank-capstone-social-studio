export interface PublisherInput {
    content: string;
    platformCode: string;
    variantId: string;
    scheduleId: string;
}

export interface PublisherPreview {
    platform: string;
    adapter: string;
    simulated: boolean;
    preview: string;
    characterCount: number;
}

export interface PublisherResult {
    success: boolean;
    externalPostId?: string;
    response?: unknown;
    error?: string;
}

export interface SocialPublisher {
    publish(input: PublisherInput): Promise<PublisherResult>;
}

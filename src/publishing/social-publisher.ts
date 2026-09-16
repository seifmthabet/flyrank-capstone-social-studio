
export interface PublisherInput {
    content: string;
    platformCode: string;
    variantId: string;
    scheduleId: string;
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
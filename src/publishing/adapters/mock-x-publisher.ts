import type {
    PublisherInput,
    PublisherPreview,
    PublisherResult,
    SocialPublisher,
} from "../social-publisher.js";

export class MockXPublisher implements SocialPublisher {
    async publish(input: PublisherInput): Promise<PublisherResult> {
        const preview: PublisherPreview = {
            platform: "x",
            adapter: "mock-x-publisher",
            simulated: true,
            preview: input.content,
            characterCount: input.content.length,
        };

        return {
            success: true,
            externalPostId: `mock_x_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            response: preview,
        };
    }
}

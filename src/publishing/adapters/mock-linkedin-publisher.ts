import type {
    PublisherInput,
    PublisherPreview,
    PublisherResult,
    SocialPublisher,
} from "../social-publisher.js";

export class MockLinkedInPublisher implements SocialPublisher {
    async publish(input: PublisherInput): Promise<PublisherResult> {
        const preview : PublisherPreview = {
            platform: "linkedin",
            adapter: "mock-linkedin-publisher",
            simulated: true,
            preview: input.content,
            characterCount: input.content.length,
        };
        
        return {
            success: true,
            externalPostId: `mock_linkedin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            response: preview,
        };
    }
}

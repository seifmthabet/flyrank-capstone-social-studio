import type {
    PublisherInput,
    PublisherResult,
    SocialPublisher,
} from "../social-publisher.js";

export class MockXPublisher implements SocialPublisher {
    async publish(input: PublisherInput): Promise<PublisherResult> {
        console.log(`[MockX] Would post to X:`, {
            content: input.content.slice(0, 100),
            scheduleId: input.scheduleId,
        });

        return {
            success: true,
            externalPostId: `mock_x_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            response: { platform: "x", simulated: true },
        };
    }
}

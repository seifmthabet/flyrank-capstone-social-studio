import type {PublisherInput, PublisherResult, SocialPublisher} from "../social-publisher.js";

export class MockLinkedInPublisher implements SocialPublisher {
    async publish(input: PublisherInput): Promise<PublisherResult> {
        console.log(`[MockLinkedIn] Would post to LinkedIn:`, {
            content: input.content.slice(0, 100),
            scheduleId: input.scheduleId,
        });

        return {
            success: true,
            externalPostId: `mock_linkedin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            response: { platform: "linkedin", simulated: true },
        };
    }
}
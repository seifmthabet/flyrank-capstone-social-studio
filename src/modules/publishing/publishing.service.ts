import type { SocialPublisher } from "../../publishing/social-publisher.js";
import type { IPlatformRepository } from "../platforms/platforms.types.js";
import type { IVariantsRepository } from "../variants/variants.types.js";
import type { IPublishingRepository } from "./publishing.types.js";

export type PublisherResolver = (adapterCode: string) => SocialPublisher

export class PublishingService {
    constructor(
        // private readonly schdulesRepository: ISchdulesRepository,
        private readonly variantsRepository: IVariantsRepository,
        private readonly platformsRepository: IPlatformRepository,
        private readonly publishingRepository: IPublishingRepository,
        private readonly resolvePublisher: PublisherResolver,
    ) {}

    async publishSchdule(scheduleId: string) {
        
    }
}
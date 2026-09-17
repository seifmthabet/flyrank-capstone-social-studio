import { AppError } from "../shared/error.js";
import { MockLinkedInPublisher } from "./adapters/mock-linkedin-publisher.js";
import { MockXPublisher } from "./adapters/mock-x-publisher.js";
import { TelegramPublisher } from "./adapters/telegram-publisher.js";
import type { SocialPublisher } from "./social-publisher.js";

const factories: Record<string, () => SocialPublisher> = {
    telegram: () => new TelegramPublisher(),
    mock_x: () => new MockXPublisher(),
    mock_linkedin: () => new MockLinkedInPublisher(),
};

const instances: Record<string, SocialPublisher> = {};

export const getPublisher = (adapterCode: string) => {
    const factory = factories[adapterCode];

    if (!factory) {
        throw AppError.notFound(`Adapter ${adapterCode} not found`);
    }

    instances[adapterCode] ??= factory();
    return instances[adapterCode];
};

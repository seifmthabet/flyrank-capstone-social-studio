import { AppError } from "../shared/error.js";
import { MockLinkedInPublisher } from "./adapters/mock-linkedin-publisher.js";
import { MockXPublisher } from "./adapters/mock-x-publisher.js";
import { TelegramPublisher } from "./adapters/telegram-publisher.js";
import type { SocialPublisher } from "./social-publisher.js";

type PublisherFactory = () => SocialPublisher;

const factories = new Map<string, PublisherFactory>([
    ["mock_linkedin", () => new MockLinkedInPublisher()],
    ["mock_x", () => new MockXPublisher()],
    ["telegram", () => new TelegramPublisher()],
])
const instances = new Map<string, SocialPublisher>();

export const listAdapters = (): string[] => {
    return [...factories.keys()].sort()
}

export const registerPublisher = (
    adapterCode: string,
    factory: PublisherFactory,
): void => {
    if (factories.has(adapterCode)) throw new Error(`Adapter with code ${adapterCode} is already registered`);
    factories.set(adapterCode, factory);
    instances.delete(adapterCode);
};

export const resetPublisherRegistery = (): void => {
    instances.clear();
};

export const getPublisher = (adapterCode: string): SocialPublisher => {
    const code = adapterCode.toLowerCase().trim();

    if (!code) throw AppError.internal(
        "Platform has no adapter code configured",
        "ADAPTER_NOT_FOUND",
        {
            adapter: adapterCode ?? null,
            knownAdapters: listAdapters(),
        },
    );

    const cached = instances.get(code);
    if (cached) return cached;

    const factory = factories.get(code);
    if (!factory) throw AppError.internal(
        `No publisher adapter registered for "${code}". Known adapters: ${listAdapters().join(", ")}`,
        "ADAPTER_NOT_FOUND",
        { adapter: code, knownAdapters: listAdapters() },
    );

    const instance = factory();
    instances.set(code, instance);
    return instance;
};

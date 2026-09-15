export type VariantStatus = "draft" | "approved" | "rejected" | "published";

export interface Variant {
    id: string;
    postId: string;
    platformId: string;
    content: string;
    status: VariantStatus;
    rejectionReason: string | null;
    generationProvider: string | null;
    generationModel: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface UpsertVariantInput {
    platformId: string;
    content: string;
    provider: string;
    model: string;
}

export interface IVariantsRepository {
    findByPostId(postId: string): Promise<Variant[]>;
    upsertVariants(postId: string, inputs: UpsertVariantInput[]): Promise<void>;
}
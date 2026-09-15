export type GenerationStatus = "queued" | "processing" | "completed" | "failed";

export interface GenerationJob {
    id: string;
    postId: string;
    status: GenerationStatus;
    attempts: number;
    error: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface GenerationJobData {
    generationJobId: string;
    postId: string;
}

export interface IGenerationRepository {
    create(postId: string): Promise<GenerationJob>;
    findById(id: string): Promise<GenerationJob | null>;
    setStatusProcessing(id: string): Promise<void>;
    setStatusCompleted(id: string): Promise<void>;
    setStatusFailed(id: string, error: string): Promise<void>;
}

export interface IGenerationService {
    createGenerationJob(postId: string): Promise<GenerationJob>;
    getGenerationJob(id: string): Promise<GenerationJob>;
    processGenerationJob(jobId: string, postId: string): Promise<void>;
}
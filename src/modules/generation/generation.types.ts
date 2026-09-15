
export interface IGenerationRepository {
    setStatusProcessing: (id: string) => void;
    setStatusCompleted: (id: string) => void;
    setStatusFailed: (id: string, error: string) => void;
}
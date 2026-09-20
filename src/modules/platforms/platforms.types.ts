export interface Platform {
    id: string;
    code: string;
    name: string;
    maxLength: number;
    tone: string;
    maxHashtags: number;
    adapter: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IPlatformRepository {
    listEnabled(): Promise<Platform[]>;
    findById(platformId: string): Promise<Platform | null>;
}

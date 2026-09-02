/** AI Interior domain models and data contracts (backend-agnostic). */

export type GenerationStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

export type GenerationType = "PREVIEW" | "STANDARD" | "HIGH" | "REVISION";

export interface AiGeneration {
  id: string;
  workspaceId: string;
  projectId: string | null;
  status: GenerationStatus;
  generationType: GenerationType;
  model: string;
  style: string | null;
  colorPreference: string | null;
  instruction: string | null;
  promptUsed: string | null;
  inputImageUrl: string | null;
  referenceImageUrl: string | null;
  outputImageUrl: string | null;
  version: number;
  approved: boolean;
  cost: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface AiCredits {
  workspaceId: string;
  balance: number;
  plan: string;
}

export interface AiSettings {
  id: string;
  workspaceId: string;
  defaultModel: string;
  costPreview: number;
  costStandard: number;
  costHigh: number;
  costRevision: number;
  dailyLimit: number;
}

export const GENERATION_TYPE_LABEL: Record<GenerationType, string> = {
  PREVIEW: "Preview",
  STANDARD: "Standard",
  HIGH: "High quality",
  REVISION: "Revision",
};

export const COLOR_PREFERENCES = [
  "Warm Natural Wood",
  "Soft White & Beige",
  "Monochrome Grey",
  "Deep Green Accent",
  "Navy & Brass",
  "Black & Walnut",
];

export interface AiRepository {
  listGenerations(workspaceId: string, projectId?: string | null): Promise<AiGeneration[]>;
  getCredits(workspaceId: string): Promise<AiCredits | null>;
  getSettings(workspaceId: string): Promise<AiSettings | null>;
  updateSettings(
    id: string,
    patch: Partial<Omit<AiSettings, "id" | "workspaceId">>,
  ): Promise<void>;
  setApproved(generationId: string, approved: boolean): Promise<void>;
  getImageUrl(path: string): Promise<string | null>;
}

/** AI Design Concept domain models (backend-agnostic). */

export type ConceptStatus =
  | "DRAFT"
  | "DESIGNER_REVIEW"
  | "PRESENTED"
  | "CUSTOMER_REVISION"
  | "APPROVED"
  | "CONVERTED";

export const CONCEPT_STAGES: ConceptStatus[] = [
  "DRAFT",
  "DESIGNER_REVIEW",
  "PRESENTED",
  "CUSTOMER_REVISION",
  "APPROVED",
  "CONVERTED",
];

export const CONCEPT_STATUS_LABEL: Record<ConceptStatus, string> = {
  DRAFT: "Draft",
  DESIGNER_REVIEW: "Designer review",
  PRESENTED: "Presented to customer",
  CUSTOMER_REVISION: "Customer revision",
  APPROVED: "Approved",
  CONVERTED: "Converted to project",
};

export const CUSTOMER_INTEREST_LEVELS = ["Cold", "Warm", "Hot", "Ready to sign"];

export interface MaterialLine {
  area: string;
  material: string;
  finishing: string;
}

export interface MaterialTier {
  label: string;
  summary: string;
  items: MaterialLine[];
}

export interface ConceptMaterials {
  premium?: MaterialTier;
  standard?: MaterialTier;
  budget?: MaterialTier;
}

export interface DesignConcept {
  id: string;
  workspaceId: string;
  projectId: string;
  generationId: string | null;
  consultationId: string | null;
  name: string;
  philosophy: string | null;
  style: string | null;
  colorPalette: string | null;
  materialDirection: string | null;
  furnitureRecommendation: string | null;
  lightingRecommendation: string | null;
  reason: string | null;
  roomAnalysis: Record<string, unknown> | null;
  opportunity: Record<string, unknown> | null;
  materials: ConceptMaterials;
  scopeOfWork: string[];
  timelineEstimate: string | null;
  nextAction: string | null;
  status: ConceptStatus;
  customerInterest: string | null;
  customerNotes: string | null;
  revisionRequest: string | null;
  approvedAt: string | null;
  proposalId: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export type ConceptPatch = Partial<
  Pick<
    DesignConcept,
    "status" | "customerInterest" | "customerNotes" | "revisionRequest" | "nextAction"
  >
>;

export type LibraryKind = "CONCEPT_TEMPLATE" | "DESIGN_STYLE" | "MATERIAL" | "PROPOSAL_TEMPLATE";

export const LIBRARY_KIND_LABEL: Record<LibraryKind, string> = {
  CONCEPT_TEMPLATE: "AI concept templates",
  DESIGN_STYLE: "Design style library",
  MATERIAL: "Material library",
  PROPOSAL_TEMPLATE: "Proposal templates",
};

export interface LibraryEntry {
  id: string;
  workspaceId: string;
  kind: LibraryKind;
  name: string;
  description: string | null;
  position: number;
}

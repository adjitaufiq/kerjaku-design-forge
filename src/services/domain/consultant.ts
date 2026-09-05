/** AI Interior Consultant domain models (backend-agnostic). */

export const SPACE_CATEGORIES = [
  "Residential",
  "Apartment",
  "Office",
  "Cafe",
  "Restaurant",
  "Commercial",
];

export const ROOM_TYPES = [
  "Living Room",
  "Bedroom",
  "Kitchen",
  "Bathroom",
  "Office Room",
  "Other",
];

export const BRIEF_PURPOSES = [
  "Renovation",
  "New Interior",
  "Makeover",
  "Furniture Improvement",
];

export const BRIEF_BUDGETS = ["Budget", "Medium", "Premium", "Luxury"];

export const BRIEF_STYLES = [
  "Modern Minimalist",
  "Japandi",
  "Scandinavian",
  "Luxury Modern",
  "Industrial",
  "Classic",
  "Tropical",
];

export const CUSTOMER_PRIORITIES = [
  "Aesthetic",
  "Functionality",
  "Storage",
  "Comfort",
  "Brand Image",
];

export type ConsultantMode = "CUSTOMER" | "DESIGNER" | "SALES";

export const CONSULTANT_MODE_LABEL: Record<ConsultantMode, string> = {
  CUSTOMER: "Customer",
  DESIGNER: "Designer assistant",
  SALES: "Sales assistant",
};

export interface DesignBrief {
  id: string;
  workspaceId: string;
  projectId: string;
  spaceCategory: string | null;
  roomType: string | null;
  purpose: string | null;
  budgetRange: string | null;
  preferredStyle: string | null;
  customerPriority: string | null;
  notes: string | null;
}

export type DesignBriefInput = Omit<DesignBrief, "id" | "workspaceId">;

export interface RoomAnalysis {
  roomType: string;
  layout: string;
  lighting: string;
  color: string;
  furniture: string;
  spaceUtilization: string;
  problems: string[];
}

export interface DesignOpportunity {
  spaceImprovement: string;
  functionalImprovement: string;
  visualImprovement: string;
  customerValue: string;
}

export interface DesignRecommendation {
  concept: string;
  reason: string;
  colorDirection: string;
  materialDirection: string;
  furnitureDirection: string;
  lightingDirection: string;
}

export interface DesignAlternative {
  option: string;
  label: string;
  concept: string;
  strengths: string;
  bestFor: string;
}

export interface SalesInsight {
  customerNeed: string;
  buyingMotivation: string;
  salesAngle: string;
}

export interface AiConsultation {
  id: string;
  workspaceId: string;
  projectId: string;
  inputImageUrl: string | null;
  roomAnalysis: RoomAnalysis | null;
  opportunity: DesignOpportunity | null;
  recommendation: DesignRecommendation | null;
  alternatives: DesignAlternative[];
  salesInsight: SalesInsight | null;
  selectedConcept: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  mode: ConsultantMode;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/** Domain models — backend-agnostic shapes used by UI and business logic. */

export type Role = "admin_workshop" | "sales" | "designer";

export type LeadStatus =
  | "NEW"
  | "CONSULTATION"
  | "AI_CONCEPT"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "DEAL"
  | "COMPLETED";

export type ProjectType =
  | "KITCHEN_SET"
  | "WARDROBE"
  | "BEDROOM_INTERIOR"
  | "OFFICE_INTERIOR"
  | "OTHER";

export type ProjectStatus = "DRAFT" | "DESIGN" | "PROPOSAL" | "PRODUCTION" | "COMPLETED";

export type ActivityType =
  | "NOTE"
  | "STAGE_CHANGE"
  | "FOLLOW_UP"
  | "PROPOSAL_SENT"
  | "AI_CONCEPT"
  | "CALL"
  | "WHATSAPP";

export type AssetType = "CLIENT_PHOTO" | "PINTEREST_REFERENCE" | "SKETCHUP_RENDER";

export interface Membership {
  workspaceId: string;
  role: Role;
}

export interface Workshop {
  id: string;
  workspaceId: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  logo: string | null;
}

export interface Lead {
  id: string;
  workspaceId: string;
  clientName: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  source: string | null;
  status: LeadStatus;
  nextFollowUp: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  leadId: string | null;
  projectName: string;
  projectType: ProjectType;
  status: ProjectStatus;
  estimatedValue: number;
  createdAt: string;
}

export interface Consultation {
  id: string;
  workspaceId: string;
  projectId: string;
  clientRequirement: string | null;
  budgetRange: string | null;
  stylePreference: string | null;
  colorPreference: string | null;
  specialRequest: string | null;
  notes: string | null;
}

export interface Activity {
  id: string;
  workspaceId: string;
  leadId: string;
  type: ActivityType;
  title: string;
  body: string | null;
  dueAt: string | null;
  createdAt: string;
}

export interface ProjectAsset {
  id: string;
  projectId: string;
  type: AssetType;
  url: string;
  createdAt: string;
}

export const LEAD_STAGES: LeadStatus[] = [
  "NEW",
  "CONSULTATION",
  "AI_CONCEPT",
  "PROPOSAL",
  "NEGOTIATION",
  "DEAL",
  "COMPLETED",
];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New Lead",
  CONSULTATION: "Consultation",
  AI_CONCEPT: "AI Concept",
  PROPOSAL: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  DEAL: "Deal",
  COMPLETED: "Completed",
};

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  KITCHEN_SET: "Kitchen Set",
  WARDROBE: "Wardrobe",
  BEDROOM_INTERIOR: "Bedroom Interior",
  OFFICE_INTERIOR: "Office Interior",
  OTHER: "Other",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: "Draft",
  DESIGN: "Design",
  PROPOSAL: "Proposal",
  PRODUCTION: "Production",
  COMPLETED: "Completed",
};

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  NOTE: "Note",
  STAGE_CHANGE: "Stage change",
  FOLLOW_UP: "Follow up",
  PROPOSAL_SENT: "Proposal sent",
  AI_CONCEPT: "AI concept",
  CALL: "Call",
  WHATSAPP: "WhatsApp",
};

export function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

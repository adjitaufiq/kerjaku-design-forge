/** Domain models — backend-agnostic shapes used by UI and business logic. */

export type Role = "admin_workshop" | "sales" | "designer";

export type LeadStatus =
  | "NEW"
  | "CONSULTATION"
  | "AI_CONCEPT"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "DEAL"
  | "PRODUCTION"
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
  | "WHATSAPP"
  | "MEETING";

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
  "PRODUCTION",
  "COMPLETED",
];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New Lead",
  CONSULTATION: "Consultation",
  AI_CONCEPT: "AI Concept",
  PROPOSAL: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  DEAL: "Deal",
  PRODUCTION: "Production",
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
  MEETING: "Meeting",
};

export function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export type ProposalStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";

export interface Proposal {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  status: ProposalStatus;
  conceptNote: string | null;
  scopeOfWork: string | null;
  materialSpec: string | null;
  terms: string | null;
  totalAmount: number;
  pdfUrl: string | null;
  shareToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalItem {
  id: string;
  workspaceId: string;
  proposalId: string;
  position: number;
  description: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface ProposalVersion {
  id: string;
  proposalId: string;
  version: number;
  pdfUrl: string | null;
  totalAmount: number;
  createdAt: string;
}


export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  CLIENT_PHOTO: "Existing room photo",
  PINTEREST_REFERENCE: "Reference image",
  SKETCHUP_RENDER: "Render",
};

export const BUDGET_RANGES = [
  "< Rp 25 jt",
  "Rp 25 – 50 jt",
  "Rp 50 – 100 jt",
  "Rp 100 – 250 jt",
  "> Rp 250 jt",
];

export const STYLE_PREFERENCES = [
  "Modern Minimalist",
  "Scandinavian",
  "Japandi",
  "Industrial",
  "Classic",
  "Luxury Modern",
];

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

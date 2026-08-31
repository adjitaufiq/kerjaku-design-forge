import type {
  Activity,
  ActivityType,
  Consultation,
  Lead,
  LeadStatus,
  Membership,
  Project,
  ProjectAsset,
  ProjectStatus,
  ProjectType,
  Proposal,
  ProposalItem,
  ProposalStatus,
  ProposalVersion,
  Workshop,
} from "./models";

/** Backend-agnostic data access contracts. */

export interface WorkspaceRepository {
  getMembership(): Promise<Membership | null>;
  getWorkshop(workspaceId: string): Promise<Workshop | null>;
  updateWorkshop(id: string, patch: Partial<Omit<Workshop, "id" | "workspaceId">>): Promise<void>;
}

export interface LeadRepository {
  list(workspaceId: string): Promise<Lead[]>;
  get(id: string): Promise<Lead | null>;
  create(
    workspaceId: string,
    input: {
      clientName: string;
      phone?: string | null;
      email?: string | null;
      location?: string | null;
      source?: string | null;
      status?: LeadStatus;
    },
  ): Promise<Lead>;
  update(id: string, patch: Partial<Pick<Lead, "status" | "nextFollowUp">>): Promise<void>;
}

export interface ProjectRepository {
  list(workspaceId: string): Promise<Project[]>;
  listByLead(leadId: string): Promise<Project[]>;
  create(
    workspaceId: string,
    input: {
      leadId: string | null;
      projectName: string;
      projectType: ProjectType;
      estimatedValue?: number;
      status?: ProjectStatus;
    },
  ): Promise<Project>;
}

export interface ConsultationRepository {
  getByProject(projectId: string): Promise<Consultation | null>;
  create(
    workspaceId: string,
    input: {
      projectId: string;
      clientRequirement?: string | null;
      budgetRange?: string | null;
      stylePreference?: string | null;
      colorPreference?: string | null;
      specialRequest?: string | null;
      notes?: string | null;
    },
  ): Promise<Consultation>;
}

export interface ActivityRepository {
  listByLead(leadId: string): Promise<Activity[]>;
  log(
    workspaceId: string,
    input: {
      leadId: string;
      type: ActivityType;
      title: string;
      body?: string | null;
      dueAt?: string | null;
    },
  ): Promise<Activity>;
}

export interface AssetRepository {
  listByProject(projectId: string): Promise<ProjectAsset[]>;
  upload(
    workspaceId: string,
    projectId: string,
    type: ProjectAsset["type"],
    file: File,
  ): Promise<ProjectAsset>;
  /** Resolve a temporary viewable URL for a stored asset path. */
  getViewUrl(path: string): Promise<string | null>;
}

export interface ProposalRepository {
  listByProjects(projectIds: string[]): Promise<Proposal[]>;
  list(workspaceId: string): Promise<Proposal[]>;
  get(id: string): Promise<Proposal | null>;
  create(workspaceId: string, input: { projectId: string; title: string }): Promise<Proposal>;
  update(
    id: string,
    patch: Partial<{
      title: string;
      status: ProposalStatus;
      conceptNote: string | null;
      scopeOfWork: string | null;
      materialSpec: string | null;
      terms: string | null;
      totalAmount: number;
      pdfUrl: string | null;
    }>,
  ): Promise<void>;
  listItems(proposalId: string): Promise<ProposalItem[]>;
  addItem(
    workspaceId: string,
    input: {
      proposalId: string;
      position: number;
      description: string;
      quantity: number;
      price: number;
    },
  ): Promise<ProposalItem>;
  updateItem(
    id: string,
    patch: Partial<{ description: string; quantity: number; price: number; position: number }>,
  ): Promise<void>;
  removeItem(id: string): Promise<void>;
  listVersions(proposalId: string): Promise<ProposalVersion[]>;
  addVersion(
    workspaceId: string,
    input: { proposalId: string; version: number; pdfUrl: string | null; totalAmount: number },
  ): Promise<ProposalVersion>;
}

export interface DataLayer {
  workspaces: WorkspaceRepository;
  leads: LeadRepository;
  projects: ProjectRepository;
  consultations: ConsultationRepository;
  activities: ActivityRepository;
  assets: AssetRepository;
  proposals: ProposalRepository;
}

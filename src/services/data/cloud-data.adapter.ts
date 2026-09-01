import { supabase } from "@/integrations/supabase/client";
import type {
  Activity,
  Consultation,
  Lead,
  Membership,
  Project,
  ProjectAsset,
  Proposal,
  ProposalItem,
  ProposalVersion,
  Workshop,
} from "../domain/models";
import type { DataLayer } from "../domain/repositories";

const BUCKET = "kerjaku-assets";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  if (res.data === null) throw new Error("No data returned");
  return res.data;
}

type Row = Record<string, unknown>;

const mapLead = (r: Row): Lead => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  clientName: r["client_name"] as string,
  phone: (r["phone"] as string) ?? null,
  email: (r["email"] as string) ?? null,
  location: (r["location"] as string) ?? null,
  source: (r["source"] as string) ?? null,
  status: r["status"] as Lead["status"],
  nextFollowUp: (r["next_follow_up"] as string) ?? null,
  createdAt: r["created_at"] as string,
  updatedAt: r["updated_at"] as string,
});

const mapProject = (r: Row): Project => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  leadId: (r["lead_id"] as string) ?? null,
  projectName: r["project_name"] as string,
  projectType: r["project_type"] as Project["projectType"],
  status: r["status"] as Project["status"],
  estimatedValue: Number(r["estimated_value"] ?? 0),
  createdAt: r["created_at"] as string,
});

const mapConsultation = (r: Row): Consultation => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  projectId: r["project_id"] as string,
  clientRequirement: (r["client_requirement"] as string) ?? null,
  budgetRange: (r["budget_range"] as string) ?? null,
  stylePreference: (r["style_preference"] as string) ?? null,
  colorPreference: (r["color_preference"] as string) ?? null,
  specialRequest: (r["special_request"] as string) ?? null,
  notes: (r["notes"] as string) ?? null,
});

const mapActivity = (r: Row): Activity => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  leadId: r["lead_id"] as string,
  type: r["type"] as Activity["type"],
  title: r["title"] as string,
  body: (r["body"] as string) ?? null,
  dueAt: (r["due_at"] as string) ?? null,
  createdAt: r["created_at"] as string,
});

const mapAsset = (r: Row): ProjectAsset => ({
  id: r["id"] as string,
  projectId: r["project_id"] as string,
  type: r["type"] as ProjectAsset["type"],
  url: r["url"] as string,
  createdAt: r["created_at"] as string,
});

const mapProposal = (r: Row): Proposal => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  projectId: r["project_id"] as string,
  title: r["title"] as string,
  status: r["status"] as Proposal["status"],
  conceptNote: (r["concept_note"] as string) ?? null,
  scopeOfWork: (r["scope_of_work"] as string) ?? null,
  materialSpec: (r["material_spec"] as string) ?? null,
  terms: (r["terms"] as string) ?? null,
  totalAmount: Number(r["total_amount"] ?? 0),
  pdfUrl: (r["pdf_url"] as string) ?? null,
  shareToken: r["share_token"] as string,
  createdAt: r["created_at"] as string,
  updatedAt: (r["updated_at"] as string) ?? (r["created_at"] as string),
});

const mapProposalItem = (r: Row): ProposalItem => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  proposalId: r["proposal_id"] as string,
  position: Number(r["position"] ?? 1),
  description: (r["description"] as string) ?? "",
  quantity: Number(r["quantity"] ?? 1),
  price: Number(r["price"] ?? 0),
  subtotal: Number(r["subtotal"] ?? 0),
});

const mapProposalVersion = (r: Row): ProposalVersion => ({
  id: r["id"] as string,
  proposalId: r["proposal_id"] as string,
  version: Number(r["version"] ?? 1),
  pdfUrl: (r["pdf_url"] as string) ?? null,
  totalAmount: Number(r["total_amount"] ?? 0),
  createdAt: r["created_at"] as string,
});

const mapWorkshop = (r: Row): Workshop => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  name: r["name"] as string,
  phone: (r["phone"] as string) ?? null,
  email: (r["email"] as string) ?? null,
  address: (r["address"] as string) ?? null,
  city: (r["city"] as string) ?? null,
  logo: (r["logo"] as string) ?? null,
});

/** Lovable Cloud implementation of the domain data layer. */
export const cloudDataLayer: DataLayer = {
  workspaces: {
    async getMembership(): Promise<Membership | null> {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return { workspaceId: data.workspace_id, role: data.role };
    },
    async getWorkshop(workspaceId) {
      const { data, error } = await supabase
        .from("workshops")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapWorkshop(data as Row) : null;
    },
    async updateWorkshop(id, patch) {
      const { error } = await supabase
        .from("workshops")
        .update({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
          ...(patch.email !== undefined ? { email: patch.email } : {}),
          ...(patch.address !== undefined ? { address: patch.address } : {}),
          ...(patch.city !== undefined ? { city: patch.city } : {}),
          ...(patch.logo !== undefined ? { logo: patch.logo } : {}),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
  },

  leads: {
    async list(workspaceId) {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapLead(r as Row));
    },
    async get(id) {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapLead(data as Row) : null;
    },
    async create(workspaceId, input) {
      const res = await supabase
        .from("leads")
        .insert({
          workspace_id: workspaceId,
          client_name: input.clientName,
          phone: input.phone ?? null,
          email: input.email ?? null,
          location: input.location ?? null,
          source: input.source ?? null,
          status: input.status ?? "NEW",
        })
        .select("*")
        .single();
      return mapLead(unwrap(res) as Row);
    },
    async update(id, patch) {
      const { error } = await supabase
        .from("leads")
        .update({
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.nextFollowUp !== undefined ? { next_follow_up: patch.nextFollowUp } : {}),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
  },

  projects: {
    async list(workspaceId) {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapProject(r as Row));
    },
    async listByLead(leadId) {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapProject(r as Row));
    },
    async create(workspaceId, input) {
      const res = await supabase
        .from("projects")
        .insert({
          workspace_id: workspaceId,
          lead_id: input.leadId,
          project_name: input.projectName,
          project_type: input.projectType,
          estimated_value: input.estimatedValue ?? 0,
          status: input.status ?? "DRAFT",
        })
        .select("*")
        .single();
      return mapProject(unwrap(res) as Row);
    },
  },

  consultations: {
    async getByProject(projectId) {
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapConsultation(data as Row) : null;
    },
    async create(workspaceId, input) {
      const res = await supabase
        .from("consultations")
        .insert({
          workspace_id: workspaceId,
          project_id: input.projectId,
          client_requirement: input.clientRequirement ?? null,
          budget_range: input.budgetRange ?? null,
          style_preference: input.stylePreference ?? null,
          color_preference: input.colorPreference ?? null,
          special_request: input.specialRequest ?? null,
          notes: input.notes ?? null,
        })
        .select("*")
        .single();
      return mapConsultation(unwrap(res) as Row);
    },
  },

  activities: {
    async listByLead(leadId) {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapActivity(r as Row));
    },
    async log(workspaceId, input) {
      const res = await supabase
        .from("lead_activities")
        .insert({
          workspace_id: workspaceId,
          lead_id: input.leadId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          due_at: input.dueAt ?? null,
        })
        .select("*")
        .single();
      return mapActivity(unwrap(res) as Row);
    },
  },

  assets: {
    async listByProject(projectId) {
      const { data, error } = await supabase
        .from("project_assets")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapAsset(r as Row));
    },
    async upload(workspaceId, projectId, type, file) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${workspaceId}/${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        ...(file.type ? { contentType: file.type } : {}),
      });
      if (uploadError) throw new Error(uploadError.message);

      const res = await supabase
        .from("project_assets")
        .insert({ workspace_id: workspaceId, project_id: projectId, type, url: path })
        .select("*")
        .single();
      return mapAsset(unwrap(res) as Row);
    },
    async getViewUrl(path) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  },

  proposals: {
    async listByProjects(projectIds) {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapProposal(r as Row));
    },
    async list(workspaceId) {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapProposal(r as Row));
    },
    async get(id) {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapProposal(data as Row) : null;
    },
    async create(workspaceId, input) {
      const res = await supabase
        .from("proposals")
        .insert({
          workspace_id: workspaceId,
          project_id: input.projectId,
          title: input.title,
        })
        .select("*")
        .single();
      return mapProposal(unwrap(res) as Row);
    },
    async update(id, patch) {
      const { error } = await supabase
        .from("proposals")
        .update({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.conceptNote !== undefined ? { concept_note: patch.conceptNote } : {}),
          ...(patch.scopeOfWork !== undefined ? { scope_of_work: patch.scopeOfWork } : {}),
          ...(patch.materialSpec !== undefined ? { material_spec: patch.materialSpec } : {}),
          ...(patch.terms !== undefined ? { terms: patch.terms } : {}),
          ...(patch.totalAmount !== undefined ? { total_amount: patch.totalAmount } : {}),
          ...(patch.pdfUrl !== undefined ? { pdf_url: patch.pdfUrl } : {}),
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    async listItems(proposalId) {
      const { data, error } = await supabase
        .from("proposal_items")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("position", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapProposalItem(r as Row));
    },
    async addItem(workspaceId, input) {
      const res = await supabase
        .from("proposal_items")
        .insert({
          workspace_id: workspaceId,
          proposal_id: input.proposalId,
          position: input.position,
          description: input.description,
          quantity: input.quantity,
          price: input.price,
          subtotal: input.quantity * input.price,
        })
        .select("*")
        .single();
      return mapProposalItem(unwrap(res) as Row);
    },
    async updateItem(id, patch) {
      const current = await supabase
        .from("proposal_items")
        .select("quantity, price")
        .eq("id", id)
        .single();
      if (current.error) throw new Error(current.error.message);
      const quantity = patch.quantity ?? Number(current.data.quantity ?? 1);
      const price = patch.price ?? Number(current.data.price ?? 0);
      const { error } = await supabase
        .from("proposal_items")
        .update({
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.position !== undefined ? { position: patch.position } : {}),
          quantity,
          price,
          subtotal: quantity * price,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    async removeItem(id) {
      const { error } = await supabase.from("proposal_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    async uploadPdf(workspaceId, proposalId, file) {
      const path = `${workspaceId}/proposals/${proposalId}/${Date.now()}.pdf`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: "application/pdf",
      });
      if (error) throw new Error(error.message);
      return path;
    },
    async getPdfUrl(path) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
    async listVersions(proposalId) {
      const { data, error } = await supabase
        .from("proposal_versions")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("version", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapProposalVersion(r as Row));
    },
    async addVersion(workspaceId, input) {
      const res = await supabase
        .from("proposal_versions")
        .insert({
          workspace_id: workspaceId,
          proposal_id: input.proposalId,
          version: input.version,
          pdf_url: input.pdfUrl,
          total_amount: input.totalAmount,
        })
        .select("*")
        .single();
      return mapProposalVersion(unwrap(res) as Row);
    },
  },
};

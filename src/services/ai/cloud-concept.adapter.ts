import { supabase } from "@/integrations/supabase/client";

import type {
  ConceptMaterials,
  ConceptStatus,
  DesignConcept,
  LibraryEntry,
  LibraryKind,
} from "../domain/concept";

type Row = Record<string, unknown>;

const mapConcept = (r: Row): DesignConcept => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  projectId: r["project_id"] as string,
  generationId: (r["generation_id"] as string) ?? null,
  consultationId: (r["consultation_id"] as string) ?? null,
  name: r["name"] as string,
  philosophy: (r["philosophy"] as string) ?? null,
  style: (r["style"] as string) ?? null,
  colorPalette: (r["color_palette"] as string) ?? null,
  materialDirection: (r["material_direction"] as string) ?? null,
  furnitureRecommendation: (r["furniture_recommendation"] as string) ?? null,
  lightingRecommendation: (r["lighting_recommendation"] as string) ?? null,
  reason: (r["reason"] as string) ?? null,
  roomAnalysis: (r["room_analysis"] as Record<string, unknown>) ?? null,
  opportunity: (r["opportunity"] as Record<string, unknown>) ?? null,
  materials: (r["materials"] as ConceptMaterials) ?? {},
  scopeOfWork: Array.isArray(r["scope_of_work"]) ? (r["scope_of_work"] as string[]) : [],
  timelineEstimate: (r["timeline_estimate"] as string) ?? null,
  nextAction: (r["next_action"] as string) ?? null,
  status: (r["status"] as ConceptStatus) ?? "DRAFT",
  customerInterest: (r["customer_interest"] as string) ?? null,
  customerNotes: (r["customer_notes"] as string) ?? null,
  revisionRequest: (r["revision_request"] as string) ?? null,
  approvedAt: (r["approved_at"] as string) ?? null,
  proposalId: (r["proposal_id"] as string) ?? null,
  imageUrl: (r["image_url"] as string) ?? null,
  createdAt: r["created_at"] as string,
});

const mapLibrary = (r: Row): LibraryEntry => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  kind: r["kind"] as LibraryKind,
  name: r["name"] as string,
  description: (r["description"] as string) ?? null,
  position: Number(r["position"] ?? 0),
});

/** Lovable Cloud data access for AI design concepts and workshop libraries. */
export const conceptData = {
  async listByProject(projectId: string): Promise<DesignConcept[]> {
    const { data, error } = await supabase
      .from("ai_design_concepts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => mapConcept(r as Row));
  },

  async listByProjects(projectIds: string[]): Promise<DesignConcept[]> {
    if (projectIds.length === 0) return [];
    const { data, error } = await supabase
      .from("ai_design_concepts")
      .select("*")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => mapConcept(r as Row));
  },

  async get(id: string): Promise<DesignConcept | null> {
    const { data, error } = await supabase
      .from("ai_design_concepts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapConcept(data as Row) : null;
  },

  async listLibrary(workspaceId: string): Promise<LibraryEntry[]> {
    const { data, error } = await supabase
      .from("ai_libraries")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("kind", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => mapLibrary(r as Row));
  },

  async addLibraryEntry(
    workspaceId: string,
    input: { kind: LibraryKind; name: string; description?: string | null },
  ): Promise<LibraryEntry> {
    const { data, error } = await supabase
      .from("ai_libraries")
      .insert({
        workspace_id: workspaceId,
        kind: input.kind,
        name: input.name,
        description: input.description ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapLibrary(data as Row);
  },

  async removeLibraryEntry(id: string): Promise<void> {
    const { error } = await supabase.from("ai_libraries").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

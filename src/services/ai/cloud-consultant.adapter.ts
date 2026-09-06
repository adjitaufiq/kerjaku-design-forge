import { supabase } from "@/integrations/supabase/client";

import type {
  AiConsultation,
  ChatMessage,
  ConsultantMode,
  DesignAlternative,
  DesignBrief,
  DesignBriefInput,
  DesignOpportunity,
  DesignRecommendation,
  RoomAnalysis,
  SalesInsight,
} from "../domain/consultant";

type Row = Record<string, unknown>;

const mapBrief = (r: Row): DesignBrief => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  projectId: r["project_id"] as string,
  spaceCategory: (r["space_category"] as string) ?? null,
  roomType: (r["room_type"] as string) ?? null,
  purpose: (r["purpose"] as string) ?? null,
  budgetRange: (r["budget_range"] as string) ?? null,
  preferredStyle: (r["preferred_style"] as string) ?? null,
  customerPriority: (r["customer_priority"] as string) ?? null,
  notes: (r["notes"] as string) ?? null,
});

const mapConsultation = (r: Row): AiConsultation => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  projectId: r["project_id"] as string,
  inputImageUrl: (r["input_image_url"] as string) ?? null,
  roomAnalysis: (r["room_analysis"] as RoomAnalysis) ?? null,
  opportunity: (r["opportunity"] as DesignOpportunity) ?? null,
  recommendation: (r["recommendation"] as DesignRecommendation) ?? null,
  alternatives: (r["alternatives"] as DesignAlternative[]) ?? [],
  salesInsight: (r["sales_insight"] as SalesInsight) ?? null,
  selectedConcept: (r["selected_concept"] as string) ?? null,
  createdAt: r["created_at"] as string,
});

/** Lovable Cloud data access for the AI Interior Consultant layer. */
export const consultantData = {
  async getBrief(projectId: string): Promise<DesignBrief | null> {
    const { data, error } = await supabase
      .from("design_briefs")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapBrief(data as Row) : null;
  },

  async saveBrief(workspaceId: string, input: DesignBriefInput): Promise<DesignBrief> {
    const existing = await consultantData.getBrief(input.projectId);
    const payload = {
      workspace_id: workspaceId,
      project_id: input.projectId,
      space_category: input.spaceCategory,
      room_type: input.roomType,
      purpose: input.purpose,
      budget_range: input.budgetRange,
      preferred_style: input.preferredStyle,
      customer_priority: input.customerPriority,
      notes: input.notes,
    };
    const query = existing
      ? supabase.from("design_briefs").update(payload).eq("id", existing.id)
      : supabase.from("design_briefs").insert(payload);
    const { data, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    return mapBrief(data as Row);
  },

  async getLatestConsultation(projectId: string): Promise<AiConsultation | null> {
    const { data, error } = await supabase
      .from("ai_consultations")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapConsultation(data as Row) : null;
  },

  async listChat(projectId: string, mode: ConsultantMode): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from("ai_chat_messages")
      .select("id, project_id, mode, role, content, created_at")
      .eq("project_id", projectId)
      .eq("mode", mode)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      projectId: r.project_id as string,
      mode: r.mode as ConsultantMode,
      role: r.role as ChatMessage["role"],
      content: r.content as string,
      createdAt: r.created_at as string,
    }));
  },
};

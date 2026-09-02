import { supabase } from "@/integrations/supabase/client";

import type { AiCredits, AiGeneration, AiRepository, AiSettings } from "../domain/ai";

const BUCKET = "kerjaku-assets";

type Row = Record<string, unknown>;

const mapGeneration = (r: Row): AiGeneration => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  projectId: (r["project_id"] as string) ?? null,
  status: r["status"] as AiGeneration["status"],
  generationType: (r["generation_type"] as AiGeneration["generationType"]) ?? "STANDARD",
  model: (r["model"] as string) ?? "",
  style: (r["style"] as string) ?? null,
  colorPreference: (r["color_preference"] as string) ?? null,
  instruction: (r["instruction"] as string) ?? null,
  promptUsed: (r["prompt_used"] as string) ?? null,
  inputImageUrl: (r["input_image_url"] as string) ?? null,
  referenceImageUrl: (r["reference_image_url"] as string) ?? null,
  outputImageUrl: (r["output_image_url"] as string) ?? null,
  version: Number(r["version"] ?? 1),
  approved: Boolean(r["approved"]),
  cost: Number(r["cost"] ?? 0),
  errorMessage: (r["error_message"] as string) ?? null,
  createdAt: r["created_at"] as string,
});

const mapSettings = (r: Row): AiSettings => ({
  id: r["id"] as string,
  workspaceId: r["workspace_id"] as string,
  defaultModel: r["default_model"] as string,
  costPreview: Number(r["cost_preview"] ?? 1),
  costStandard: Number(r["cost_standard"] ?? 2),
  costHigh: Number(r["cost_high"] ?? 3),
  costRevision: Number(r["cost_revision"] ?? 2),
  dailyLimit: Number(r["daily_limit"] ?? 20),
});

/** Lovable Cloud implementation of the AI data contracts. */
export const cloudAiRepository: AiRepository = {
  async listGenerations(workspaceId, projectId) {
    let query = supabase
      .from("ai_generations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (projectId) query = query.eq("project_id", projectId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => mapGeneration(r as Row));
  },

  async getCredits(workspaceId): Promise<AiCredits | null> {
    const { data, error } = await supabase
      .from("ai_credits")
      .select("workspace_id, balance, plan")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { workspaceId: data.workspace_id, balance: data.balance, plan: data.plan };
  },

  async getSettings(workspaceId) {
    const { data, error } = await supabase
      .from("ai_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSettings(data as Row) : null;
  },

  async updateSettings(id, patch) {
    const { error } = await supabase
      .from("ai_settings")
      .update({
        ...(patch.defaultModel !== undefined ? { default_model: patch.defaultModel } : {}),
        ...(patch.costPreview !== undefined ? { cost_preview: patch.costPreview } : {}),
        ...(patch.costStandard !== undefined ? { cost_standard: patch.costStandard } : {}),
        ...(patch.costHigh !== undefined ? { cost_high: patch.costHigh } : {}),
        ...(patch.costRevision !== undefined ? { cost_revision: patch.costRevision } : {}),
        ...(patch.dailyLimit !== undefined ? { daily_limit: patch.dailyLimit } : {}),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async setApproved(generationId, approved) {
    const { error } = await supabase
      .from("ai_generations")
      .update({ approved })
      .eq("id", generationId);
    if (error) throw new Error(error.message);
  },

  async getImageUrl(path) {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) return null;
    return data?.signedUrl ?? null;
  },
};

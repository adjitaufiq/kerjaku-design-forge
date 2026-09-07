import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const BUCKET = "kerjaku-assets";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TEXT_MODEL = "google/gemini-3.7-flash";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function toDataUrl(admin: Admin, path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buffer = await data.arrayBuffer();
  return `data:${data.type || "image/jpeg"};base64,${Buffer.from(buffer).toString("base64")}`;
}

function gatewayError(status: number, body: string): Error {
  if (status === 429) return new Error("AI is busy right now — please retry shortly.");
  if (status === 402)
    return new Error("AI credits for this app are exhausted. Add credits to continue.");
  if (status === 403) return new Error("AI access is blocked for this workspace.");
  return new Error(`AI request failed (${status}): ${body.slice(0, 200)}`);
}

async function callGateway(messages: Array<Record<string, unknown>>): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this workspace.");
  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw gatewayError(response.status, await response.text());
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The AI returned an empty answer. Please try again.");
  return content;
}

function parseJson(raw: string): Record<string, unknown> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(slice) as Record<string, unknown>;
  } catch {
    throw new Error("The AI answer could not be read. Please try again.");
  }
}

const CONCEPT_SYSTEM = [
  "You are the lead interior designer of an Indonesian custom-interior workshop.",
  "From a room photo, the customer brief and the AI room analysis, you write a complete design concept",
  "that a designer can present to a customer and a sales person can turn into a proposal.",
  "Write in Bahasa Indonesia, professional, concrete, no generic filler, no pricing numbers.",
  "Answer with JSON only matching exactly this shape:",
  `{"name":"","philosophy":"","style":"","colorPalette":"","materialDirection":"","furnitureRecommendation":"","lightingRecommendation":"","reason":"",`,
  `"roomAnalysis":{"roomType":"","size":"","layout":"","lighting":"","existingFurniture":"","visualProblems":["",""]},`,
  `"opportunity":{"improvementArea":"","functionalImprovement":"","aestheticImprovement":"","customerValue":""},`,
  `"materials":{"premium":{"label":"Premium Option","summary":"","items":[{"area":"","material":"","finishing":""}]},`,
  `"standard":{"label":"Standard Option","summary":"","items":[{"area":"","material":"","finishing":""}]},`,
  `"budget":{"label":"Budget Option","summary":"","items":[{"area":"","material":"","finishing":""}]}},`,
  `"scopeOfWork":["",""],"timelineEstimate":"","nextAction":""}`,
].join(" ");

interface GenerateConceptInput {
  projectId: string;
  generationId?: string | null;
  imagePath?: string | null;
}

/** Turn an AI visualisation plus the room analysis into a documented design concept. */
export const generateConcept = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GenerateConceptInput) => {
    if (!input?.projectId) throw new Error("A project is required");
    return input;
  })
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    const { data: project, error } = await supabase
      .from("projects")
      .select("id, workspace_id, project_type, project_name")
      .eq("id", input.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found");

    const [{ data: brief }, { data: consultation }] = await Promise.all([
      supabase.from("design_briefs").select("*").eq("project_id", input.projectId).maybeSingle(),
      supabase
        .from("ai_consultations")
        .select("*")
        .eq("project_id", input.projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let imagePath = input.imagePath ?? null;
    if (!imagePath && input.generationId) {
      const { data: generation } = await supabase
        .from("ai_generations")
        .select("output_image_url, input_image_url")
        .eq("id", input.generationId)
        .maybeSingle();
      imagePath = generation?.output_image_url ?? generation?.input_image_url ?? null;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const image = await toDataUrl(supabaseAdmin, imagePath);

    const contextText = [
      `Project: ${project.project_name} (${String(project.project_type).replace(/_/g, " ").toLowerCase()}).`,
      brief
        ? `Customer brief: space ${brief.space_category ?? "-"}, room ${brief.room_type ?? "-"}, purpose ${brief.purpose ?? "-"}, budget ${brief.budget_range ?? "-"}, style ${brief.preferred_style ?? "-"}, priority ${brief.customer_priority ?? "-"}, notes ${brief.notes ?? "-"}.`
        : "Customer brief: not filled in yet.",
      consultation
        ? `Existing AI analysis (JSON): ${JSON.stringify({
            roomAnalysis: consultation.room_analysis,
            opportunity: consultation.opportunity,
            recommendation: consultation.recommendation,
          })}`
        : "No earlier room analysis.",
      "Produce the design concept JSON.",
    ].join("\n\n");

    const userContent: unknown = image
      ? [
          { type: "text", text: contextText },
          { type: "image_url", image_url: { url: image } },
        ]
      : contextText;

    const raw = await callGateway([
      { role: "system", content: CONCEPT_SYSTEM },
      { role: "user", content: userContent },
    ]);

    const parsed = parseJson(raw) as Record<string, Json>;

    const { data: saved, error: saveError } = await supabaseAdmin
      .from("ai_design_concepts")
      .insert({
        workspace_id: project.workspace_id,
        project_id: input.projectId,
        generation_id: input.generationId ?? null,
        consultation_id: consultation?.id ?? null,
        name: (parsed["name"] as string) || "Design concept",
        philosophy: (parsed["philosophy"] as string) ?? null,
        style: (parsed["style"] as string) ?? null,
        color_palette: (parsed["colorPalette"] as string) ?? null,
        material_direction: (parsed["materialDirection"] as string) ?? null,
        furniture_recommendation: (parsed["furnitureRecommendation"] as string) ?? null,
        lighting_recommendation: (parsed["lightingRecommendation"] as string) ?? null,
        reason: (parsed["reason"] as string) ?? null,
        room_analysis: parsed["roomAnalysis"] ?? null,
        opportunity: parsed["opportunity"] ?? null,
        materials: parsed["materials"] ?? {},
        scope_of_work: parsed["scopeOfWork"] ?? [],
        timeline_estimate: (parsed["timelineEstimate"] as string) ?? null,
        next_action: (parsed["nextAction"] as string) ?? null,
        image_url: imagePath,
        created_by: userId,
      })
      .select("id")
      .single();
    if (saveError) throw new Error(saveError.message);

    return { id: saved.id };
  });

interface UpdateConceptInput {
  conceptId: string;
  status?: string | null;
  customerInterest?: string | null;
  customerNotes?: string | null;
  revisionRequest?: string | null;
  nextAction?: string | null;
}

/** Move a concept through the approval workflow and record customer feedback. */
export const updateConcept = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UpdateConceptInput) => {
    if (!input?.conceptId) throw new Error("A concept is required");
    return input;
  })
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    const { data: concept, error } = await supabase
      .from("ai_design_concepts")
      .select("id, status")
      .eq("id", input.conceptId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!concept) throw new Error("Concept not found");

    const patch: Record<string, unknown> = {};
    if (input.status) {
      patch["status"] = input.status;
      if (input.status === "APPROVED") {
        patch["approved_at"] = new Date().toISOString();
        patch["approved_by"] = userId;
      }
    }
    if (input.customerInterest !== undefined) patch["customer_interest"] = input.customerInterest;
    if (input.customerNotes !== undefined) patch["customer_notes"] = input.customerNotes;
    if (input.revisionRequest !== undefined) patch["revision_request"] = input.revisionRequest;
    if (input.nextAction !== undefined) patch["next_action"] = input.nextAction;

    const { error: updateError } = await supabase
      .from("ai_design_concepts")
      .update(patch)
      .eq("id", input.conceptId);
    if (updateError) throw new Error(updateError.message);

    return { ok: true };
  });

/** Create a draft proposal (no final pricing) out of an approved design concept. */
export const createProposalFromConcept = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conceptId: string }) => {
    if (!input?.conceptId) throw new Error("A concept is required");
    return input;
  })
  .handler(async ({ data: input, context }) => {
    const { supabase } = context;

    const { data: concept, error } = await supabase
      .from("ai_design_concepts")
      .select("*")
      .eq("id", input.conceptId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!concept) throw new Error("Concept not found");
    if (concept.proposal_id) return { proposalId: concept.proposal_id as string };

    const scope = Array.isArray(concept.scope_of_work) ? (concept.scope_of_work as string[]) : [];
    const materials = (concept.materials ?? {}) as Record<
      string,
      { label?: string; summary?: string; items?: { area?: string; material?: string; finishing?: string }[] }
    >;

    const materialSpec = Object.values(materials)
      .filter(Boolean)
      .map((tier) => {
        const lines = (tier.items ?? [])
          .map((i) => `- ${i.area ?? "-"}: ${i.material ?? "-"} (${i.finishing ?? "-"})`)
          .join("\n");
        return `${tier.label ?? "Option"}\n${tier.summary ?? ""}\n${lines}`.trim();
      })
      .join("\n\n");

    const conceptNote = [
      concept.name,
      concept.philosophy,
      concept.reason,
      concept.color_palette ? `Palet warna: ${concept.color_palette}` : null,
      concept.lighting_recommendation ? `Pencahayaan: ${concept.lighting_recommendation}` : null,
      concept.timeline_estimate ? `Estimasi waktu: ${concept.timeline_estimate}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: proposal, error: insertError } = await supabaseAdmin
      .from("proposals")
      .insert({
        workspace_id: concept.workspace_id,
        project_id: concept.project_id,
        title: `${concept.name} — Proposal`,
        concept_note: conceptNote,
        scope_of_work: scope.map((s, i) => `${i + 1}. ${s}`).join("\n"),
        material_spec: materialSpec,
        terms:
          "Harga final ditentukan setelah survey lokasi dan persetujuan material. Proposal ini adalah dokumen awal berdasarkan konsep desain AI.",
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);

    await supabaseAdmin
      .from("ai_design_concepts")
      .update({ proposal_id: proposal.id })
      .eq("id", input.conceptId);

    return { proposalId: proposal.id as string };
  });

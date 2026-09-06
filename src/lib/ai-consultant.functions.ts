import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const BUCKET = "kerjaku-assets";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TEXT_MODEL = "google/gemini-3.7-flash";

interface BriefPayload {
  spaceCategory?: string | null;
  roomType?: string | null;
  purpose?: string | null;
  budgetRange?: string | null;
  preferredStyle?: string | null;
  customerPriority?: string | null;
  notes?: string | null;
}

interface AnalyzeInput {
  projectId: string;
  imagePath: string;
  brief: BriefPayload;
}

interface AskInput {
  projectId: string;
  mode: "CUSTOMER" | "DESIGNER" | "SALES";
  question: string;
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function toDataUrl(admin: Admin, path: string): Promise<string | null> {
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

async function callGateway(
  messages: Array<Record<string, unknown>>,
  jsonMode: boolean,
): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this workspace.");

  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!response.ok) throw gatewayError(response.status, await response.text());
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
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

function briefText(brief: BriefPayload): string {
  return [
    `Space category: ${brief.spaceCategory ?? "-"}`,
    `Room type: ${brief.roomType ?? "-"}`,
    `Purpose: ${brief.purpose ?? "-"}`,
    `Budget level: ${brief.budgetRange ?? "-"}`,
    `Preferred style: ${brief.preferredStyle ?? "-"}`,
    `Customer priority: ${brief.customerPriority ?? "-"}`,
    `Extra notes: ${brief.notes ?? "-"}`,
  ].join("\n");
}

const ANALYSIS_SYSTEM = [
  "You are a senior interior design consultant for an Indonesian custom-interior workshop.",
  "You analyse a real room photo together with a customer design brief and produce a",
  "consultative report that helps a designer and a sales person win the project.",
  "Write in Bahasa Indonesia, professional but easy to understand.",
  "Be concrete about the room in the photo — never generic filler.",
  "Answer with JSON only, no markdown, matching exactly this shape:",
  `{"roomAnalysis":{"roomType":"","layout":"","lighting":"","color":"","furniture":"","spaceUtilization":"","problems":["",""]},`,
  `"opportunity":{"spaceImprovement":"","functionalImprovement":"","visualImprovement":"","customerValue":""},`,
  `"recommendation":{"concept":"","reason":"","colorDirection":"","materialDirection":"","furnitureDirection":"","lightingDirection":""},`,
  `"alternatives":[{"option":"A","label":"Safe Choice","concept":"","strengths":"","bestFor":""},{"option":"B","label":"Creative Choice","concept":"","strengths":"","bestFor":""},{"option":"C","label":"Premium Choice","concept":"","strengths":"","bestFor":""}],`,
  `"salesInsight":{"customerNeed":"","buyingMotivation":"","salesAngle":""}}`,
].join(" ");

/** Analyse a room photo against the customer brief and store the consultation result. */
export const analyzeRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AnalyzeInput) => {
    if (!input?.projectId) throw new Error("A project is required");
    if (!input.imagePath) throw new Error("A room photo is required");
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const image = await toDataUrl(supabaseAdmin, input.imagePath);
    if (!image) throw new Error("Could not read the room photo.");

    const raw = await callGateway(
      [
        { role: "system", content: ANALYSIS_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Project: ${project.project_name} (${String(project.project_type).replace(/_/g, " ").toLowerCase()}).\n\nCustomer design brief:\n${briefText(input.brief)}\n\nAnalyse the attached room photo and return the JSON report.`,
            },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      true,
    );

    const parsed = parseJson(raw) as Record<string, Json>;

    const { data: brief } = await supabase
      .from("design_briefs")
      .select("id")
      .eq("project_id", input.projectId)
      .maybeSingle();

    const { data: saved, error: saveError } = await supabaseAdmin
      .from("ai_consultations")
      .insert({
        workspace_id: project.workspace_id,
        project_id: input.projectId,
        brief_id: brief?.id ?? null,
        input_image_url: input.imagePath,
        room_analysis: parsed["roomAnalysis"] ?? null,
        opportunity: parsed["opportunity"] ?? null,
        recommendation: parsed["recommendation"] ?? null,
        alternatives: parsed["alternatives"] ?? [],
        sales_insight: parsed["salesInsight"] ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (saveError) throw new Error(saveError.message);

    return { id: saved.id };
  });

const MODE_SYSTEM: Record<AskInput["mode"], string> = {
  CUSTOMER:
    "You are a friendly interior consultant talking to the customer. Explain simply, reassure, and always end with a concrete suggestion or next step. Never mention internal material codes or margins.",
  DESIGNER:
    "You are a senior interior designer helping a colleague. Give professional, specific design guidance: proportions, materials, lighting layers, colour ratios, and the reasoning behind each choice.",
  SALES:
    "You are a sales strategist for a custom-interior workshop. Focus on customer need, buying motivation, objections and a concrete approach to close the project.",
};

/** Ask the AI consultant a question grounded in the project brief, analysis and concepts. */
export const askConsultant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AskInput) => {
    if (!input?.projectId) throw new Error("A project is required");
    if (!input.question?.trim()) throw new Error("Write a question first");
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

    const [{ data: brief }, { data: consultation }, { data: history }] = await Promise.all([
      supabase.from("design_briefs").select("*").eq("project_id", input.projectId).maybeSingle(),
      supabase
        .from("ai_consultations")
        .select("*")
        .eq("project_id", input.projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("ai_chat_messages")
        .select("role, content")
        .eq("project_id", input.projectId)
        .eq("mode", input.mode)
        .order("created_at", { ascending: true })
        .limit(20),
    ]);

    const contextText = [
      `Project: ${project.project_name} (${String(project.project_type).replace(/_/g, " ").toLowerCase()}).`,
      brief
        ? `Customer brief:\n${briefText({
            spaceCategory: brief.space_category,
            roomType: brief.room_type,
            purpose: brief.purpose,
            budgetRange: brief.budget_range,
            preferredStyle: brief.preferred_style,
            customerPriority: brief.customer_priority,
            notes: brief.notes,
          })}`
        : "Customer brief: not filled in yet.",
      consultation
        ? `Latest AI room analysis and recommendation (JSON):\n${JSON.stringify({
            roomAnalysis: consultation.room_analysis,
            opportunity: consultation.opportunity,
            recommendation: consultation.recommendation,
            alternatives: consultation.alternatives,
          })}`
        : "No room analysis yet.",
    ].join("\n\n");

    const messages: Array<Record<string, unknown>> = [
      {
        role: "system",
        content: `${MODE_SYSTEM[input.mode]}\nAnswer in Bahasa Indonesia, max 180 words, no markdown headings.\n\nContext:\n${contextText}`,
      },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: input.question },
    ];

    const answer = await callGateway(messages, false);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_chat_messages").insert([
      {
        workspace_id: project.workspace_id,
        project_id: input.projectId,
        mode: input.mode,
        role: "user",
        content: input.question,
        created_by: userId,
      },
      {
        workspace_id: project.workspace_id,
        project_id: input.projectId,
        mode: input.mode,
        role: "assistant",
        content: answer,
        created_by: userId,
      },
    ]);

    return { answer };
  });

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "kerjaku-assets";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";

type GenerationType = "PREVIEW" | "STANDARD" | "HIGH" | "REVISION";

interface GenerateInput {
  projectId: string;
  generationType: GenerationType;
  style?: string | null;
  colorPreference?: string | null;
  instruction?: string | null;
  inputImagePath: string;
  referenceImagePath?: string | null;
  previousGenerationId?: string | null;
}

const SYSTEM_PROMPT = [
  "You are a professional interior architectural visualizer.",
  "You edit a photograph of a real room. You MUST preserve the exact room geometry:",
  "camera perspective and focal length, wall positions, ceiling height, floor plane,",
  "window and door positions and sizes, and overall proportions. Do not move, add or",
  "remove architectural openings, and do not change the viewpoint.",
  "You may only improve: furniture and built-in cabinetry design, material realism and",
  "texture, colour palette, lighting quality and styling accessories.",
  "Output one photorealistic interior photograph, natural lighting, high detail,",
  "professional interior photography quality. No text, no watermark, no collage.",
].join(" ");

function buildPrompt(input: GenerateInput, projectType: string): string {
  const parts = [
    `Redesign this ${projectType.replace(/_/g, " ").toLowerCase()} interior.`,
    input.style ? `Design style: ${input.style}.` : "",
    input.colorPreference ? `Colour preference: ${input.colorPreference}.` : "",
    input.instruction ? `Client instruction: ${input.instruction}` : "",
    input.previousGenerationId
      ? "This is a revision of the attached previous AI result: apply the instruction while keeping the same room structure and camera angle."
      : "",
    "Keep the original room structure, perspective and openings exactly as in the source photo.",
  ];
  return parts.filter(Boolean).join(" ");
}

async function toDataUrl(
  admin: {
    storage: {
      from: (b: string) => {
        download: (p: string) => Promise<{ data: Blob | null; error: unknown }>;
      };
    };
  },
  path: string,
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buffer = await data.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const type = data.type || "image/jpeg";
  return `data:${type};base64,${base64}`;
}

/** Generate an interior concept from a room photo, charging AI credits on success only. */
export const generateInterior = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: GenerateInput) => {
    if (!input?.projectId) throw new Error("A project is required");
    if (!input.inputImagePath) throw new Error("A room photo is required");
    return input;
  })
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, project_type")
      .eq("id", input.projectId)
      .maybeSingle();
    if (projectError) throw new Error(projectError.message);
    if (!project) throw new Error("Project not found");
    const workspaceId = project.workspace_id;

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership || !["admin_workshop", "designer"].includes(membership.role)) {
      throw new Error("Only designers and workshop admins can generate AI concepts");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let { data: settings } = await supabase
      .from("ai_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!settings) {
      const created = await supabaseAdmin
        .from("ai_settings")
        .insert({ workspace_id: workspaceId })
        .select("*")
        .single();
      settings = created.data;
    }
    if (!settings) throw new Error("AI settings unavailable");

    const cost =
      input.generationType === "PREVIEW"
        ? settings.cost_preview
        : input.generationType === "HIGH"
          ? settings.cost_high
          : input.generationType === "REVISION"
            ? settings.cost_revision
            : settings.cost_standard;

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", since.toISOString());
    if ((count ?? 0) >= settings.daily_limit) {
      throw new Error(
        `Daily generation limit reached (${settings.daily_limit}). Try again tomorrow.`,
      );
    }

    let { data: credits } = await supabase
      .from("ai_credits")
      .select("balance")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!credits) {
      const createdCredits = await supabaseAdmin
        .from("ai_credits")
        .insert({ workspace_id: workspaceId })
        .select("balance")
        .single();
      credits = createdCredits.data;
    }
    const balance = credits?.balance ?? 0;
    if (balance < cost) {
      throw new Error(`Not enough AI credits: this generation needs ${cost}, you have ${balance}.`);
    }

    const { count: versionCount } = await supabaseAdmin
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", input.projectId);
    const version = (versionCount ?? 0) + 1;

    const prompt = buildPrompt(input, project.project_type as string);

    const { data: generation, error: genError } = await supabaseAdmin
      .from("ai_generations")
      .insert({
        workspace_id: workspaceId,
        project_id: input.projectId,
        user_id: userId,
        created_by: userId,
        model: settings.default_model || IMAGE_MODEL,
        generation_type: input.generationType,
        style: input.style ?? null,
        color_preference: input.colorPreference ?? null,
        instruction: input.instruction ?? null,
        prompt,
        prompt_used: prompt,
        input_image_url: input.inputImagePath,
        reference_image_url: input.referenceImagePath ?? null,
        version,
        cost,
        status: "PROCESSING",
      })
      .select("*")
      .single();
    if (genError || !generation) throw new Error(genError?.message ?? "Could not start generation");

    async function fail(message: string): Promise<never> {
      await supabaseAdmin
        .from("ai_generations")
        .update({ status: "FAILED", error_message: message })
        .eq("id", generation!.id);
      throw new Error(message);
    }

    try {
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) return await fail("AI is not configured for this workspace.");

      const roomImage = await toDataUrl(supabaseAdmin, input.inputImagePath);
      if (!roomImage) return await fail("Could not read the room photo.");
      const referenceImage = input.referenceImagePath
        ? await toDataUrl(supabaseAdmin, input.referenceImagePath)
        : null;

      const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
      content.push({ type: "image_url", image_url: { url: roomImage } });
      if (referenceImage) {
        content.push({
          type: "text",
          text: "Style reference image (mood only, do not copy geometry):",
        });
        content.push({ type: "image_url", image_url: { url: referenceImage } });
      }

      const response = await fetch(GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.default_model || IMAGE_MODEL,
          modalities: ["image", "text"],
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 429)
          return await fail("AI is busy right now — please retry shortly.");
        if (response.status === 402)
          return await fail("AI credits for this app are exhausted. Add credits to continue.");
        if (response.status === 403) return await fail("AI access is blocked for this workspace.");
        return await fail(`AI generation failed (${response.status}): ${body.slice(0, 200)}`);
      }

      const payload = (await response.json()) as {
        choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
      };
      const dataUrl = payload.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!dataUrl)
        return await fail("The AI returned no image. Try a different photo or instruction.");

      const base64 = dataUrl.split(",")[1] ?? "";
      const bytes = Buffer.from(base64, "base64");
      const path = `${workspaceId}/${input.projectId}/ai/${generation.id}-v${version}.png`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (uploadError) return await fail(uploadError.message);

      await supabaseAdmin
        .from("ai_generations")
        .update({ status: "SUCCESS", output_image_url: path, image_url: path })
        .eq("id", generation.id);

      await supabaseAdmin.from("ai_transactions").insert({
        workspace_id: workspaceId,
        generation_id: generation.id,
        credit_used: cost,
        transaction_type: input.generationType === "REVISION" ? "REVISION" : "GENERATION",
        status: "SUCCESS",
      });
      await supabaseAdmin
        .from("ai_credits")
        .update({ balance: balance - cost })
        .eq("workspace_id", workspaceId);

      if (input.previousGenerationId) {
        await supabaseAdmin.from("ai_revisions").insert({
          workspace_id: workspaceId,
          generation_id: input.previousGenerationId,
          instruction: input.instruction ?? "",
          previous_image_url: input.inputImagePath,
          new_image_url: path,
          version,
          created_by: userId,
        });
      }

      return {
        id: generation.id,
        outputImagePath: path,
        version,
        cost,
        creditsLeft: balance - cost,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI generation failed";
      await supabaseAdmin
        .from("ai_generations")
        .update({ status: "FAILED", error_message: message })
        .eq("id", generation.id);
      throw new Error(message);
    }
  });

/** Approve or unapprove an AI concept (workspace members only). */
export const setGenerationApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { generationId: string; approved: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_generations")
      .select("id, workspace_id")
      .eq("id", data.generationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Concept not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("ai_generations")
      .update({ approved: data.approved })
      .eq("id", data.generationId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });

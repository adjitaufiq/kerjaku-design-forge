import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE = "https://ai.gateway.lovable.dev/v1/videos";
const MODEL = "google/veo-3.1-fast";

export const VEO_ANGLES = {
  push: "Slow cinematic dolly push-in straight toward the main object at eye level, smooth gimbal motion.",
  orbit: "Slow smooth parallax orbit arc around the object from left to right, revealing its depth and side panels, eye level.",
  drone: "Slow drone descent from a higher angle down to eye level while gently moving forward toward the object.",
  glide: "Slow lateral slider glide from right to left past the object at eye level, gentle parallax with foreground and background.",
  pullout: "Start close on the object's detail, then slow smooth pull-back revealing the full object and its environment.",
} as const;
export type VeoAngle = keyof typeof VEO_ANGLES;

function prompt(angle: VeoAngle) {
  return [
    "Photorealistic architectural interior video animated from the provided image.",
    `Camera: ${VEO_ANGLES[angle]}`,
    "STRICT LOCK: the furniture/booth/object, its shape, proportions, colours, materials, HPL patterns, signage, text and logos must stay EXACTLY identical to the image for the whole clip. Do not add, remove, morph, redesign or change any object. No new text.",
    "Only the camera moves; the scene is static except subtle natural light reflections and, if people already exist in the image, small natural movement.",
    "Steady, professional, slow cinematic motion, no cuts, no shaking, no zoom distortion.",
  ].join(" ");
}

type Job = { id: string; status: string; error?: { message?: string } };

async function gateway(path: string, init?: RequestInit) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI belum dikonfigurasi.");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  });
  if (!res.ok && res.status !== 302) {
    if (res.status === 402) throw new Error("Kredit AI habis. Tambah kredit untuk lanjut.");
    if (res.status === 429) throw new Error("AI video sedang sibuk, coba lagi sebentar.");
    if (res.status === 403) throw new Error("Akses AI video diblokir untuk workspace ini.");
    const t = await res.text();
    console.error("veo error", res.status, t);
    throw new Error(`AI video gagal (${res.status})`);
  }
  return res;
}

export const startVeoVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string; angle: VeoAngle }) => {
    if (!input?.image?.startsWith("data:image")) throw new Error("Foto render tidak valid");
    if (!(input.angle in VEO_ANGLES)) throw new Error("Angle tidak dikenal");
    return input;
  })
  .handler(async ({ data }) => {
    const [head, b64 = ""] = data.image.split(",");
    const mimeType = head?.includes("png") ? "image/png" : "image/jpeg";
    const res = await gateway("", {
      method: "POST",
      body: JSON.stringify({
        model: MODEL,
        instances: [
          { prompt: prompt(data.angle), image: { bytesBase64Encoded: b64, mimeType } },
        ],
        parameters: {
          durationSeconds: 8,
          resolution: "720p",
          sampleCount: 1,
          generateAudio: false,
          negativePrompt:
            "morphing furniture, changing shape, new objects, distorted text, warped logo, extra cabinets, camera shake",
        },
      }),
    });
    const job = (await res.json()) as Job;
    return { id: job.id };
  });

export const pollVeoVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id || !/^[\w-]+$/.test(input.id)) throw new Error("Job tidak valid");
    return input;
  })
  .handler(async ({ data }) => {
    const job = (await (await gateway(`/${data.id}`)).json()) as Job;
    if (job.status === "failed")
      return { status: "failed" as const, error: job.error?.message ?? "Video gagal dibuat" };
    if (job.status !== "completed") return { status: "running" as const };
    const file = await gateway(`/${data.id}/content`);
    const buf = Buffer.from(await file.arrayBuffer());
    return { status: "completed" as const, video: `data:video/mp4;base64,${buf.toString("base64")}` };
  });

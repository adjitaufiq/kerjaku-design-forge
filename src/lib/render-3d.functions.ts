import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/edits";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

interface RenderInput {
  sketch: string; // data URL of the SketchUp / 3D screenshot
  anchor?: string | null; // data URL of the already-rendered master view (Foto 1)
  scene: string; // editable prompt from the user
  keepDimensions?: boolean;
}

function buildPrompt(input: RenderInput): string {
  return [
    "IMAGE 1 is a raw 3D model screenshot (SketchUp / CAD) of a piece of custom furniture or a booth. Treat it as a FIXED PRODUCTION BLUEPRINT.",
    input.anchor
      ? "IMAGE 2 is the already-approved photoreal render of the SAME object from another camera angle. It is the MASTER STYLE ANCHOR: reuse exactly its materials, wood grain, colours, floor, background environment, ceiling and lighting temperature so both images look like the same place photographed at the same moment. Only the camera angle follows IMAGE 1."
      : "",
    "Task: turn IMAGE 1 into a photorealistic professional architectural render photo.",
    "GEOMETRY LOCK (100%): keep the exact camera angle, perspective, framing, proportions, every edge, panel, frame, arch, opening, shelf, column, counter, cabinet and door split exactly as modelled. Do NOT add, remove, round, warp, extend, shorten or redesign any part of the object.",
    "COLOUR & MATERIAL LOCK: keep every original colour (e.g. yellow stays the same yellow, brown wood stays the same brown); only upgrade flat cartoon surfaces to real physical materials (real wood grain, real paint, real metal, real glass, real stone) with correct reflections and shadows.",
    "TEXT & LOGO LOCK: keep every brand name, signage, logo and poster on the object with the EXACT same spelling, letters, layout and artwork. Never invent or garble text.",
    input.keepDimensions
      ? "Keep the dimension lines, arrows and measurement numbers visible and legible as a technical overlay."
      : "CLEAN: remove all dimension lines, arrows, measurement numbers (cm/mm), labels, axis lines, the SketchUp logo and any software UI.",
    "Ignore drafting helpers: plain white/grey boxes, boundary planes, hatched placeholder panels or reference blocks outside the main object are NOT part of the design — remove them and replace with the real environment.",
    "Replace the plain grey/empty background with a real environment as described below, at realistic eye level camera height.",
    "NO EXTRA OBJECTS: do not add people, products, decorations, plants, screens or props unless the scene description below explicitly asks for them.",
    `Scene description from the workshop: ${input.scene}`,
    "Output one single photorealistic photo with the same aspect ratio as IMAGE 1. No watermark, no collage, no added captions.",
  ]
    .filter(Boolean)
    .join(" ");
}

const toBlob = (dataUrl: string) => {
  const [head, b64 = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head ?? "")?.[1] ?? "image/jpeg";
  return new Blob([Buffer.from(b64, "base64")], { type: mime });
};

export const render3d = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RenderInput) => {
    if (!input?.sketch?.startsWith("data:image")) throw new Error("Upload gambar 3D dulu");
    if (!input.scene?.trim()) throw new Error("Prompt suasana masih kosong");
    if (input.anchor && !input.anchor.startsWith("data:image")) input.anchor = null;
    return input;
  })
  .handler(async ({ data: input }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI belum dikonfigurasi.");
    const form = new FormData();
    form.append("model", IMAGE_MODEL);
    form.append("prompt", buildPrompt(input));
    form.append("image[]", toBlob(input.sketch), "sketch.jpg");
    if (input.anchor) form.append("image[]", toBlob(input.anchor), "anchor.jpg");

    const response = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      if (response.status === 429) throw new Error("AI sedang sibuk, coba lagi sebentar.");
      if (response.status === 402) throw new Error("Kredit AI habis. Tambah kredit untuk lanjut.");
      if (response.status === 403) throw new Error("Akses AI diblokir untuk workspace ini.");
      const body = await response.text();
      throw new Error(`AI gagal (${response.status}): ${body.slice(0, 160)}`);
    }
    const payload = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
    const first = payload.data?.[0];
    const image = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : first?.url;
    if (!image) throw new Error("AI tidak menghasilkan gambar. Coba gambar lain.");
    return { image };
  });

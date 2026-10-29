import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/edits";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

interface RenderInput {
  sketch: string; // data URL of the SketchUp / 3D screenshot
  anchor?: string | null; // data URL of the already-rendered master view (Foto 1)
  scene: string; // editable prompt from the user
  ratio?: string; // output frame, e.g. 4:5
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
    "REAL-WORLD SCALE for any added item: a TV must be a real modern flat-screen with a true 16:9 widescreen ratio and thin bezel, sized like a real 50-65 inch TV relative to the furniture, centered with visible margin around it. TV GEOMETRY IS MANDATORY: the screen is a wide, short horizontal rectangle — its width is 1.78x its height (height ≈ 56% of width). NEVER square, NEVER 4:3, NEVER near-square, NEVER portrait. Do NOT stretch the TV vertically to fill a tall niche or panel; if the niche is taller, keep the TV wide and short and leave the backdrop panel visible above and below it. People, products and appliances must also be true real-life scale.",
    `FRAME: output exactly ${input.ratio ?? "4:5"} aspect ratio, same as IMAGE 1. IMAGE 1 may have flat grey padding bands around the drawing — they are empty canvas, not part of the design: fill them seamlessly with more of the same environment (ceiling, floor, surroundings) using a slightly wide-angle eye-level camera, keeping the whole object fully visible, centered and unchanged.`,
    "Output one single photorealistic photo. No watermark, no collage, no added captions, no grey bars.",
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

const CHAT_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const SCAN_MODEL = "openai/gpt-6-astra";

export interface ScanResult {
  object: "booth" | "kitchen" | "wardrobe" | "backdrop" | "counter" | "furniture";
  summary: string;
  location: "mall" | "ruko" | "cafe" | "indoor" | "outdoor" | "rumah" | "kantor" | "sekolah";
  ideas: string[];
}

const OBJ_IDS = ["booth", "kitchen", "wardrobe", "backdrop", "counter", "furniture"];
const LOC_IDS = ["mall", "ruko", "cafe", "indoor", "outdoor", "rumah", "kantor", "sekolah"];

export const scan3d = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sketch: string }) => {
    if (!input?.sketch?.startsWith("data:image")) throw new Error("Upload gambar 3D dulu");
    return input;
  })
  .handler(async ({ data: input }): Promise<ScanResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI belum dikonfigurasi.");
    const instruction = [
      "Kamu asisten render interior. Lihat screenshot model 3D (SketchUp) ini.",
      `Tentukan object salah satu dari: ${OBJ_IDS.join(", ")} (backdrop = backdrop/panel TV, booth = booth/kiosk jualan, counter = meja resepsionis/kasir).`,
      `Tentukan location paling cocok dari: ${LOC_IDS.join(", ")}.`,
      "summary: 1 kalimat Bahasa Indonesia yang menjelaskan apa yang terlihat (bentuk, warna, material, tulisan/brand jika ada).",
      "ideas: 3-5 ide tambahan singkat (Bahasa Indonesia, maks 20 kata masing-masing) yang realistis dan proporsional untuk membuat render lebih menjual. Jangan ubah bentuk desain.",
      "Aturan wajib: jika ada area/panel kosong untuk TV, sebutkan ukuran nyata, contoh 'Tambah Smart TV 55 inch widescreen 16:9 (lebar hampir 2x tinggi, pipih memanjang, tidak kotak), bezel tipis, layar menyala, sisakan panel kosong di atas & bawah TV'. Untuk booth makanan: etalase berisi produk realistis, signage menyala, kasir/antrian. Untuk kitchen set: kompor tanam, cooker hood, sink, LED strip. Untuk lemari: LED strip dalam, pakaian tergantung rapi.",
      'Jawab HANYA JSON: {"object":"...","location":"...","summary":"...","ideas":["..."]}',
    ].join("\n");
    const res = await fetch(CHAT_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SCAN_MODEL,
        reasoning_effort: "low",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "scan",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["object", "location", "summary", "ideas"],
              properties: {
                object: { type: "string", enum: OBJ_IDS },
                location: { type: "string", enum: LOC_IDS },
                summary: { type: "string" },
                ideas: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: input.sketch } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("AI sedang sibuk, coba lagi sebentar.");
      if (res.status === 402) throw new Error("Kredit AI habis. Tambah kredit untuk lanjut.");
      if (res.status === 403) throw new Error("Akses AI diblokir untuk workspace ini.");
      throw new Error(`Scan gagal (${res.status})`);
    }
    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = (payload.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "");
    let parsed: Partial<ScanResult> = {};
    try {
      parsed = JSON.parse(raw) as Partial<ScanResult>;
    } catch {
      throw new Error("Hasil scan tidak terbaca, coba Scan ulang.");
    }
    return {
      object: (OBJ_IDS.includes(parsed.object ?? "") ? parsed.object : "furniture") as ScanResult["object"],
      location: (LOC_IDS.includes(parsed.location ?? "") ? parsed.location : "indoor") as ScanResult["location"],
      summary: String(parsed.summary ?? ""),
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas.map(String).slice(0, 5) : [],
    };
  });

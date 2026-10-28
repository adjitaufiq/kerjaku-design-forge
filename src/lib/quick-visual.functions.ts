import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/edits";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

export type QuickItem = "KITCHEN_SET" | "WARDROBE" | "TV_CABINET" | "BACKDROP";

const ITEM_LABEL: Record<QuickItem, string> = {
  KITCHEN_SET: "kitchen set (base cabinets, wall cabinets, countertop and backsplash panel)",
  WARDROBE: "built-in wardrobe",
  TV_CABINET: "TV cabinet / media wall unit",
  BACKDROP: "wall backdrop panel",
};

interface QuickInput {
  roomImage: string; // data URL
  referenceImage: string; // data URL
  item: QuickItem;
  note?: string | null;
}

function buildPrompt(input: QuickInput): string {
  const item = ITEM_LABEL[input.item];
  return [
    `IMAGE 1 is a real photo of a client's room. IMAGE 2 is a product reference photo of a ${item}.`,
    `Task: install the ${item} shown in IMAGE 2 into the room in IMAGE 1, as if a workshop produced and installed it on site.`,
    "LOCKED — keep these pixel-identical to IMAGE 1: camera angle, perspective, framing, walls and wall paint colour,",
    "ceiling, ceiling lamps and all existing light fixtures, floor and floor tiles, windows, doors, electrical outlets,",
    "pipes, and all lighting conditions. Do not repaint, relight, restyle or redecorate anything.",
    `ONLY CHANGE: the area where the ${item} goes. Replace any old cabinetry there with the new ${item}.`,
    "Copy from IMAGE 2: cabinet layout style, door design, colours, materials, finishes, handles and countertop.",
    "Fit it to the real wall size and position in IMAGE 1 with correct perspective, scale, contact shadows and reflections",
    "matching the existing light in IMAGE 1. Do not copy the room, walls, floor or lighting of IMAGE 2.",
    input.note ? `Extra note from the workshop: ${input.note}` : "",
    "Output a single photorealistic photo with the same aspect ratio as IMAGE 1. No text, no watermark, no collage.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** One-shot visualizer: no client/project data needed. Returns the result as a data URL. */
export const quickVisualize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: QuickInput) => {
    if (!input?.roomImage?.startsWith("data:image"))
      throw new Error("Upload the client room photo");
    if (!input.referenceImage?.startsWith("data:image"))
      throw new Error("Upload the reference photo");
    if (!ITEM_LABEL[input.item]) throw new Error("Choose what to install");
    return input;
  })
  .handler(async ({ data: input }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const toBlob = (dataUrl: string) => {
      const [head, b64 = ""] = dataUrl.split(",");
      const mime = /data:([^;]+)/.exec(head ?? "")?.[1] ?? "image/jpeg";
      return new Blob([Buffer.from(b64, "base64")], { type: mime });
    };
    const form = new FormData();
    form.append("model", IMAGE_MODEL);
    form.append("prompt", buildPrompt(input));
    form.append("image[]", toBlob(input.roomImage), "room.jpg");
    form.append("image[]", toBlob(input.referenceImage), "reference.jpg");

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
    if (!image) throw new Error("AI tidak menghasilkan gambar. Coba foto lain.");
    return { image };
  });

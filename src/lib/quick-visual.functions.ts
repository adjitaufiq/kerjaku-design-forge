import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ALL_ITEMS,
  APPLIANCE_TAG_CLEAN,
  APPLIANCE_TAG_KEEP,
  CEILING_ITEM_ID,
  RESKIN_TARGETS,
  type ReskinTarget,
} from "@/lib/quick-visual-catalog";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/edits";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

interface QuickInput {
  roomImage: string; // data URL
  referenceImage?: string | null; // data URL, optional
  items: string[];
  note?: string | null;
}

interface ReskinInput {
  baseImage: string; // data URL of an earlier result
  target: ReskinTarget;
  swatchImage?: string | null; // HPL / material photo
  colorText?: string | null; // e.g. "putih matte"
}

/**
 * Kitchen appliance rule (3 modes):
 * - default: appliances may follow IMAGE 2.
 * - KEEP ("Pakai peralatan asli Before"): only IMAGE 1 appliances, nothing added.
 * - CLEAN ("Kitchen set bersih"): cabinetry only, zero appliances.
 */
export function applianceRule(input: { items: string[]; note?: string | null }): string {
  if (!input.items.includes("KITCHEN_SET")) return "";
  const note = input.note ?? "";
  const keep = note.includes(APPLIANCE_TAG_KEEP);
  const clean = note.includes(APPLIANCE_TAG_CLEAN);
  const hood = note.includes("Ada cooker hood");
  const noSink = note.includes("Tanpa wastafel / keran");
  const noOven = note.includes("Tanpa oven tanam");
  const addSink = note.includes("Tambah wastafel baru");
  const rules: string[] = [];
  const solidUppers =
    "CABINET DESIGN STAYS LIKE IMAGE 2: this appliance rule changes ONLY appliances. Keep the upper and base cabinet design of IMAGE 2 exactly — same door split, door rows, open shelf / open niche, crown, handles and built-in cabinet lights (LED strip under the uppers, downlights). Where IMAGE 2 has a cooker hood, remove only the hood itself and leave that cabinet section as the same empty open niche / shelf; do not redesign the cabinets.";
  if (clean) {
    rules.push(
      "APPLIANCES (STRICT — CABINETRY ONLY): IMAGE 2 is ONLY a reference for cabinet style, doors, colours, HPL finish, handles and countertop material.",
      "The result shows ONLY the new kitchen set (base cabinets, upper cabinets, countertop, backsplash). NO stove, NO hob, NO induction, NO cooker hood, NO oven, NO fridge, NO microwave, NO sink, NO tap, NO kettle, NO utensils, NO bottles, NO decorations — the countertop is clean and empty.",
      "Remove the old stove and clutter from IMAGE 1 too; do not copy any appliance or object from IMAGE 2.",
      hood ? "" : solidUppers,
    );
  } else if (keep) {
    rules.push(
      "APPLIANCES (STRICT — KEEP BEFORE): IMAGE 2 is ONLY a reference for cabinet style, doors, colours, HPL finish, handles and countertop material. Copy ZERO appliances or objects from IMAGE 2.",
      "Keep exactly the client's real appliances from IMAGE 1 (e.g. a freestanding tabletop gas stove stays the same tabletop gas stove, same position, now on the new countertop). Do not upgrade, replace or restyle them.",
      "Do NOT add anything that is not in IMAGE 1: no cooker hood, no chimney, no exhaust, no built-in hob, no induction, no oven, no fridge, no microwave, no sink or tap unless IMAGE 1 already has one.",
      hood ? "" : solidUppers,
    );
  } else {
    rules.push(
      "APPLIANCES: appliances may follow IMAGE 2 (hob, cooker hood, oven, sink and tap as shown in IMAGE 2), integrated into the new cabinets.",
    );
  }
  if (hood) rules.push("Include one cooker hood above the stove, integrated into the upper cabinets.");
  if (noSink) rules.push("No sink and no tap anywhere.");
  if (noOven) rules.push("No built-in oven anywhere.");
  if (addSink && !clean) rules.push("Add one new undermount sink with a tap in the countertop.");
  return rules.filter(Boolean).join(" ");
}

function buildPromptOnly(input: QuickInput): string {
  const chosen = ALL_ITEMS.filter((i) => input.items.includes(i.id));
  const what = chosen.map((i) => i.prompt).join(", ") || "furniture";
  return buildPrompt({ ...input, referenceImage: "x" })
    .replace(/IMAGE 1 is a real photo[^.]*\.[^.]*\./, `IMAGE 1 is a real photo of a client's room. There is NO reference photo. Task: design and install a new ${what} into the room in IMAGE 1, as if a workshop produced and installed it on site, following ONLY the workshop note below for style, colours and finish (if the note is silent, use a clean modern minimalist style with neutral HPL).`)
    .replace(/Copy from IMAGE 2:[^.]*\./, "")
    .replace(/Do not copy the room, walls, floor or lighting of IMAGE 2\./, "")
    .replace(/like IMAGE 2 /g, "")
    .replace(/IMAGE 2/g, "the workshop note");
}

function buildPrompt(input: QuickInput): string {
  const chosen = ALL_ITEMS.filter((i) => input.items.includes(i.id));
  const upgradeCeiling = input.items.includes(CEILING_ITEM_ID);
  const item = chosen
    .filter((i) => i.id !== CEILING_ITEM_ID)
    .map((i) => i.prompt)
    .join(", ");
  const what = item || (upgradeCeiling ? "ceiling design" : "furniture");
  return [
    `IMAGE 1 is a real photo of a client's room. IMAGE 2 is a product reference photo of a ${what}.`,
    `Task: install the ${what} shown in IMAGE 2 into the room in IMAGE 1, as if a workshop produced and installed it on site.`,
    upgradeCeiling
      ? "LOCKED — keep these pixel-identical to IMAGE 1: camera angle, perspective, framing, walls and wall paint colour, floor and floor tiles, windows, doors, electrical outlets, pipes. Do not repaint, restyle or redecorate anything else."
      : "LOCKED — keep these pixel-identical to IMAGE 1: camera angle, perspective, framing, walls and wall paint colour, ceiling, ceiling lamps and all existing light fixtures, floor and floor tiles, windows, doors, electrical outlets, pipes, and all lighting conditions. Do not repaint, relight, restyle or redecorate anything.",
    `ONLY CHANGE: the area where the ${what} goes. Replace any old cabinetry there with the new ${what}.`,
    upgradeCeiling
      ? "ALSO CHANGE the ceiling: install a new flat gypsum drop ceiling with recessed downlights and indirect warm LED cove lighting."
      : "",
    "Copy from IMAGE 2: cabinet layout style, door design, colours, materials, finishes, handles and countertop.",
    "Fit it to the real wall size and position in IMAGE 1 with correct perspective, scale, contact shadows and reflections",
    "matching the existing light in IMAGE 1. Do not copy the room, walls, floor or lighting of IMAGE 2.",
    "CABINET RULES (custom workshop quality): every cabinet run must be one clean, straight, continuous rectangular block.",
    "Upper / wall cabinets must have one perfectly level top line and one level bottom line across the whole run, with all doors the same height.",
    "NEVER notch, step, cut out or shorten a cabinet to avoid a vent, small window opening, glass block, pipe, cable, hook, shelf or rough wall patch.",
    "Instead, keep the cabinet at its normal full size and build it straight in front of the obstacle so the cabinet simply covers and hides it.",
    "Remove old shelves, racks, curtains and clutter in the installation area.",
    "Upper cabinet HEIGHT: use a normal standard upper cabinet height like IMAGE 2 (a regular wall cabinet, NOT up to the ceiling) with one level top line. Only extend upper cabinets all the way to the ceiling / roof if the workshop note explicitly asks for it (e.g. 'sampai plafon' / 'full plafon'); then ONLY make them taller — keep the same door layout, open niche, handles, crown and lights as IMAGE 2.",
    "Built-in cabinet lights (LED strip under the upper cabinets, downlights in the cabinet crown) are part of the furniture: copy them from IMAGE 2 and keep them on, unless the workshop note says no LED. If the note asks for LED strip, add it.",
    "Base cabinets: one straight, level plinth and countertop line; the countertop is one continuous slab.",
    "The 'LOCKED' list applies to the room outside the cabinet area; elements behind the new cabinets may be covered.",
    applianceRule(input),
    input.note ? `Extra note from the workshop: ${input.note}` : "",
    "Output a single photorealistic photo with the same aspect ratio as IMAGE 1. No text, no watermark, no collage.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildReskinPrompt(input: ReskinInput): string {
  const target = RESKIN_TARGETS.find((t) => t.value === input.target)!;
  const material = input.swatchImage
    ? `the exact laminate (HPL) pattern, wood grain, colour and sheen shown in IMAGE 2${input.colorText ? ` (${input.colorText})` : ""}`
    : `this finish: ${input.colorText}`;
  return [
    "IMAGE 1 is a finished interior photo.",
    input.swatchImage ? "IMAGE 2 is a material / HPL sample photo." : "",
    `Task: re-finish ${target.prompt} with ${material}.`,
    "LOCKED — keep everything else pixel-identical to IMAGE 1: camera, perspective, room, walls, ceiling, floor, lighting,",
    "cabinet shape, number of doors and drawers, door split lines, handles, appliances, sink, tap, LED strips and every other surface.",
    "Do not change the design, only the surface finish of the target. Keep realistic grain scale, reflections and shadows.",
    "Output a single photorealistic photo with the same aspect ratio as IMAGE 1. No text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}

const toBlob = (dataUrl: string) => {
  const [head, b64 = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head ?? "")?.[1] ?? "image/jpeg";
  return new Blob([Buffer.from(b64, "base64")], { type: mime });
};

async function callEdit(prompt: string, images: string[]): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured.");
  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("prompt", prompt);
  images.forEach((img, i) => form.append("image[]", toBlob(img), `image-${i}.jpg`));

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
  return image;
}

/** One-shot visualizer: no client/project data needed. Returns the result as a data URL. */
export const quickVisualize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: QuickInput) => {
    if (!input?.roomImage?.startsWith("data:image"))
      throw new Error("Upload the client room photo");
    if (input.referenceImage && !input.referenceImage.startsWith("data:image"))
      throw new Error("Foto referensi tidak valid");
    if (!input.referenceImage && !input.note?.trim())
      throw new Error("Tanpa foto referensi, tulis dulu catatan / prompt desainnya");
    const valid = (input.items ?? []).filter((id) => ALL_ITEMS.some((i) => i.id === id));
    if (!valid.length) throw new Error("Pilih minimal satu item yang dipasang");
    return { ...input, items: valid };
  })
  .handler(async ({ data: input }) => {
    const image = input.referenceImage
      ? await callEdit(buildPrompt(input), [input.roomImage, input.referenceImage])
      : await callEdit(buildPromptOnly(input), [input.roomImage]);
    return { image };
  });

/** Change only the HPL / colour of one part of an earlier result. */
export const quickReskin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReskinInput) => {
    if (!input?.baseImage?.startsWith("data:image")) throw new Error("Pilih visual dulu");
    if (!RESKIN_TARGETS.some((t) => t.value === input.target)) throw new Error("Pilih bagian");
    if (!input.swatchImage?.startsWith("data:image") && !input.colorText?.trim())
      throw new Error("Upload foto HPL atau ketik warnanya");
    return input;
  })
  .handler(async ({ data: input }) => {
    const images = [input.baseImage];
    if (input.swatchImage?.startsWith("data:image")) images.push(input.swatchImage);
    const image = await callEdit(buildReskinPrompt(input), images);
    return { image };
  });

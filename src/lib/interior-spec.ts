import { z } from "zod";

export const SHAPES = ["single", "L", "U"] as const;
export const moduleSchema = z.object({
  label: z.string().trim().min(1).max(80),
  level: z.enum(["lower", "upper", "tall"]),
  side: z.enum(["main", "wing", "wing2"]),
  fullCeiling: z.boolean(),
  finish: z.string().trim().max(160),
  contents: z.string().trim().max(300),
});
export type CabinetModule = z.infer<typeof moduleSchema>;

export const MATERIALS = [
  "pvc-board-18",
  "eco-pvc-18",
  "multiplek-18",
  "blockboard-18",
  "blockmin-1s-18",
  "blockmin-2s-18",
  "hybrid",
] as const;
export const GLUES = ["active", "starmax"] as const;
export const specHintsSchema = z.object({
  material: z.enum(MATERIALS).optional(),
  outside: z.enum(["hpl", "hpl_premium", "duco"]),
  inside: z.enum(["blockmin", "tacosheet", "hpl"]),
  hinge: z.enum(["slowmo", "slowmo_stainless", "biasa"]),
  slide: z.enum(["dt_slowmo", "dt_biasa", "dt_eco", "push", "tandem", "roller"]),
  glue: z.enum(GLUES).optional(),
  accessories: z
    .array(
      z.object({
        id: z.enum(["rak-piring", "rak-gelas", "rak-sayur", "rak-bumbu", "tray-sendok"]),
        position: z.string().trim().min(1, "Isi posisi setiap aksesori").max(300),
      }),
    )
    .max(20),
  // Layout/modules come from an AI pre-fill the workshop reviews; never measurements.
  shape: z.enum(SHAPES).optional(),
  modules: z.array(moduleSchema).max(12).optional(),
});

export const SHAPE_LABEL: Record<(typeof SHAPES)[number], string> = {
  single: "Lurus (single line)",
  L: "Letter L",
  U: "Letter U",
};
const LEVEL_LABEL = { lower: "Kabinet bawah", upper: "Kabinet atas", tall: "Kabinet tinggi" };
const SIDE_LABEL = { main: "sisi utama", wing: "sayap L", wing2: "sayap U" };
export function defaultModules(shape: (typeof SHAPES)[number]): CabinetModule[] {
  const sides = shape === "single" ? (["main"] as const) : shape === "L" ? (["main", "wing"] as const) : (["main", "wing", "wing2"] as const);
  return sides.flatMap((side) =>
    (["lower", "upper"] as const).map((level) => ({
      label: shape === "single" ? LEVEL_LABEL[level] : `${LEVEL_LABEL[level]} (${SIDE_LABEL[side]})`,
      level,
      side,
      fullCeiling: false,
      finish: "",
      contents: "",
    })),
  );
}
export type SpecHints = z.infer<typeof specHintsSchema>;
export const INTERIOR_ACTIVITY_TITLE = "Tampak Dalam / Spek SME";
export const interiorRecordSchema = z.object({
  projectId: z.string(),
  baseAssetId: z.string(),
  interiorAssetId: z.string().optional(),
  specHints: specHintsSchema,
});
export type InteriorRecord = z.infer<typeof interiorRecordSchema>;
export function parseInteriorRecord(raw: string | null): InteriorRecord | null {
  try {
    const parsed = interiorRecordSchema.safeParse(JSON.parse(raw ?? ""));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const SPEC_OPTIONS = {
  material: [
    { value: "pvc-board-18", label: "TACO PVC Board 18mm" },
    { value: "eco-pvc-18", label: "TACO ECO PVC Board 18mm" },
    { value: "multiplek-18", label: "Multiplek 18mm" },
    { value: "blockboard-18", label: "Blockboard 18mm" },
  ],
  outside: [
    { value: "hpl", label: "HPL" },
    { value: "hpl_premium", label: "HPL Premium" },
    { value: "duco", label: "Duco" },
  ],
  inside: [
    { value: "blockmin", label: "Blockmin putih polos" },
    { value: "tacosheet", label: "Tacosheet" },
    { value: "hpl", label: "HPL" },
  ],
  hinge: [
    { value: "slowmo", label: "Slow motion" },
    { value: "biasa", label: "Biasa" },
  ],
  slide: [
    { value: "dt_slowmo", label: "Double track slow motion" },
    { value: "dt_biasa", label: "Double track biasa" },
    { value: "push", label: "Push" },
    { value: "tandem", label: "Tandem" },
  ],
};
export const ACCESSORIES = [
  { id: "rak-piring", label: "Rak piring" },
  { id: "rak-gelas", label: "Rak gelas" },
  { id: "rak-sayur", label: "Rak sayur tarik" },
  { id: "rak-bumbu", label: "Rak bumbu / botol" },
  { id: "tray-sendok", label: "Tray sendok" },
] as const;

export function buildInteriorPrompt(spec: SpecHints, note = ""): string {
  const label = (key: keyof typeof SPEC_OPTIONS, value: string) =>
    SPEC_OPTIONS[key].find((o) => o.value === value)?.label ?? value;
  return [
    "IMAGE 1 is the client's selected finished After render, the immutable exterior design reference.",
    "Create ONE additional photorealistic open-door interior view, from exactly the same camera, framing, perspective and aspect ratio.",
    "LOCK the cabinet carcass dimensions, module count, positions, outside colours, outside HPL grain, materials, handles, countertop, sink, appliances, walls, ceiling, floor and lighting. Never resize, remove, redesign or add cabinet modules. No full-ceiling extension.",
    "ONLY articulate the existing upper and lower cabinet doors open on their hinges, realistically avoiding collisions; pull existing drawers partially out so their runners can be seen. Do not invent drawers where there were doors, or change panel widths. Open doors retain their original exterior finish.",
    `Selected outside specification: ${label("outside", spec.outside)}; retain IMAGE 1's exact outside appearance. Selected interior finish: ${label("inside", spec.inside)}. Hinge: ${label("hinge", spec.hinge)}. Drawer runners: ${label("slide", spec.slide)}. Show realistic shelving inside existing modules.`,
    spec.accessories.length
      ? `ONLY these selected accessories, in exactly these workshop-specified positions: ${spec.accessories.map((a) => `${ACCESSORIES.find((x) => x.id === a.id)?.label}: ${a.position}`).join("; ")}. Do not add any unselected accessory.`
      : "No accessory inserts are selected. Show plain shelves only; no dish racks, vegetable pullouts, spice inserts or cutlery trays.",
    "Positions count cabinet modules from the viewer's left unless explicitly specified otherwise. Keep every accessory inside its existing cabinet footprint. Do not fabricate measurements or label inferred dimensions.",
    note ? `Workshop clarification, subordinate to the exterior design locks: ${note}` : "",
    "Output one photo, no collage, no dimension text, no annotations, no watermark. This is a visual concept, not a measured production drawing.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** SME contract (1 Jalur, full TACO): explicit name/category per module + brand fields. */
export function toSmeSpec(spec: SpecHints) {
  const cat = { lower: "kitchen-base", upper: "kitchen-upper", tall: "kitchen-tall" } as const;
  return {
    ...spec,
    brand: "TACO",
    material: spec.material ?? "pvc-board-18",
    hardware: spec.hinge === "slowmo" ? "taco-hinge-slowmo" : "taco-hinge",
    drawerSlide: spec.slide,
    glue: "taco-active",
    modules: (spec.modules ?? []).map((m) => ({ ...m, name: m.label, category: cat[m.level] })),
  };
}

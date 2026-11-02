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
export const ACCESSORY_IDS = [
  "rak-piring",
  "rak-gelas",
  "rak-sayur",
  "rak-bumbu",
  "tray-sendok",
  "keranjang-tarik",
  "hidrolik",
  "ventilasi",
] as const;
export const EDGES = ["edging", "tusir", "list_gold", "list_chrome", "list_black"] as const;
export const TOP_LAYERS = ["1", "2"] as const;
export const HANDLES = ["none", "profile_j", "push", "handle"] as const;
export const GLASSES = ["none", "dark", "clear", "fluted"] as const;
export const LIGHTINGS = ["none", "led", "spot", "led_spot"] as const;
/** Kode HPL per bagian. Tiap kode berbeda = minimal 1 lembar utuh dibeli. */
export const hplCodesSchema = z.object({
  lower: z.string().trim().max(60),
  upperSame: z.boolean(),
  upper: z.string().trim().max(60),
  top: z.string().trim().max(60),
  hasAccent: z.boolean(),
  accent: z.string().trim().max(60),
  accentNote: z.string().trim().max(120),
});
export type HplCodes = z.infer<typeof hplCodesSchema>;
export const tacoInfoSchema = z.object({
  code: z.string().max(30),
  name: z.string().max(80),
  texture: z.string().max(40),
  image: z.string().max(400).optional(),
});
export type TacoInfo = z.infer<typeof tacoInfoSchema>;
/** "th 1205-fc" -> "1205 FC" (key shared by UI, prompt and SME). */
export function normTacoCode(text: string): string {
  const m = /(\d{3,5})[\s-]*([A-Z]{1,3})\b/.exec(text.toUpperCase().replace(/TACO|HPL/g, " "));
  return m ? `${m[1]} ${m[2]}` : "";
}
export function tacoInfoFor(spec: SpecHints, code: string): TacoInfo | undefined {
  const k = normTacoCode(code);
  return k ? spec.hplInfo?.[k] : undefined;
}
/** Prompt text for one code: official name + texture, never a guess. */
export function tacoDesc(spec: SpecHints, code: string): string {
  const i = tacoInfoFor(spec, code);
  return i ? `TACO ${i.code} "${i.name}" (${i.texture})` : `TACO ${code}`;
}
/** One physical front, listed top-to-bottom inside a column. "double" = 2 swing leaves side by side. */
export const FRONT_TYPES = ["swing", "double", "drawer", "lift_glass", "lift_wood", "glass_swing", "open"] as const;
export type FrontType = (typeof FRONT_TYPES)[number];
export const FRONT_LABEL: Record<FrontType, string> = {
  swing: "1 pintu swing",
  double: "2 pintu swing (dobel)",
  drawer: "1 laci",
  lift_glass: "Pintu kaca angkat",
  lift_wood: "Pintu kayu angkat",
  glass_swing: "1 pintu kaca swing",
  open: "Rak terbuka",
};
const FRONT_PROMPT: Record<FrontType, string> = {
  swing: "exactly ONE single swing door leaf",
  double: "exactly TWO swing door leaves side by side meeting at a centre gap (a pair)",
  drawer: "ONE drawer front, pulled out",
  lift_glass: "ONE horizontal glass lift-up flap door raised upward on gas springs",
  lift_wood: "ONE horizontal solid lift-up flap door raised upward on gas springs",
  glass_swing: "exactly ONE single glass swing door leaf",
  open: "an open niche with NO door",
};
export const columnSchema = z.object({ fronts: z.array(z.enum(FRONT_TYPES)).min(1).max(8) });
export const frontLayoutSchema = z.object({
  upper: z.array(columnSchema).max(16),
  lower: z.array(columnSchema).max(16),
});
export type FrontLayout = z.infer<typeof frontLayoutSchema>;
/** Hardware derived from the workshop-entered front layout (hinge 1 set = 2 pcs per swing leaf). */
export function layoutCounts(l: FrontLayout | undefined) {
  const all = [...(l?.upper ?? []), ...(l?.lower ?? [])].flatMap((c) => c.fronts);
  const n = (t: FrontType) => all.filter((f) => f === t).length;
  const swing = n("swing") + n("glass_swing") + 2 * n("double");
  const lift = n("lift_glass") + n("lift_wood");
  return { swing, drawers: n("drawer"), lift, hingeSets: swing, slideSets: n("drawer"), gasSpringPcs: lift * 2 };
}
/** Strict gate for interior views: schema-valid, at least one cabinet row, no empty column. */
export function validateInteriorBlueprint(l: unknown): { valid: true; layout: FrontLayout } | { valid: false; error: string } {
  if (l === undefined || l === null) return { valid: false, error: "Struktur pintu per kolom wajib diisi sebelum membuat tampak dalam." };
  const parsed = frontLayoutSchema.safeParse(l);
  if (!parsed.success) return { valid: false, error: "Struktur pintu tidak valid: periksa jenis bagian dan jumlah kolom." };
  const { upper, lower } = parsed.data;
  if (!upper.length && !lower.length) return { valid: false, error: "Isi minimal satu kolom di kabinet atas atau bawah." };
  return { valid: true, layout: parsed.data };
}
/** Deterministic short hash of the blueprint (same result in browser and server). */
export function blueprintHash(l: FrontLayout): string {
  const s = JSON.stringify({ upper: l.upper.map((c) => c.fronts), lower: l.lower.map((c) => c.fronts) });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}
/** Explicit left-to-right blueprint; the strongest structure lock in the interior prompt. */
export function layoutPrompt(l: FrontLayout | undefined): string {
  if (!l || (!l.upper.length && !l.lower.length)) return "";
  const row = (name: string, cols: FrontLayout["upper"]) =>
    cols.length
      ? `${name}: EXACTLY ${cols.length} vertical columns, counted from the viewer's left. ` +
        cols
          .map((c, i) => `Column ${i + 1} (top to bottom): ${c.fronts.map((f) => FRONT_PROMPT[f]).join(", then ")}.`)
          .join(" ")
      : "";
  const c = layoutCounts(l);
  return [
    "FRONT BLUEPRINT (verified by the workshop, overrides anything you infer from IMAGE 1):",
    row("UPPER CABINETS", l.upper),
    row("BASE CABINETS", l.lower),
    `TOTAL in the whole image: exactly ${c.swing} swing door leaves, ${c.drawers} drawers and ${c.lift} lift-up flap doors. Never draw more or fewer leaves, never merge columns, never split a single leaf into two, never turn a single door into a pair. Column widths follow IMAGE 1.`,
  ]
    .filter(Boolean)
    .join(" ");
}
export const generationRecordSchema = z.object({
  generationId: z.string().max(64),
  view: z.enum(["interior", "interior_side"]),
  blueprintVersion: z.number().int().optional(),
  blueprintHash: z.string().max(16),
  frontLayout: frontLayoutSchema,
  status: z.literal("GENERATED"),
  createdAt: z.string().max(40),
});
export type GenerationRecord = z.infer<typeof generationRecordSchema>;
export const specHintsSchema = z.object({
  frontLayout: frontLayoutSchema.optional(),
  // Snapshot of the exact blueprint each interior image was generated from.
  generations: z.array(generationRecordSchema).max(20).optional(),
  material: z.enum(MATERIALS).optional(),
  outside: z.enum(["hpl", "hpl_premium", "tacosheet", "duco"]),
  inside: z.enum(["blockmin", "tacosheet", "hpl"]),
  hinge: z.enum(["slowmo", "slowmo_stainless", "biasa"]),
  slide: z.enum(["dt_slowmo", "dt_biasa", "dt_eco", "push", "tandem", "roller"]),
  glue: z.enum(GLUES).optional(),
  accessories: z
    .array(
      z.object({
        id: z.enum(ACCESSORY_IDS),
        position: z.string().trim().min(1, "Isi posisi setiap aksesori").max(300),
        // Hidrolik: jumlah daun pintu angkat (1 daun = 2 pcs gas spring).
        doors: z.number().int().min(1).max(20).optional(),
      }),
    )
    .max(20),
  // Layout/modules come from an AI pre-fill the workshop reviews; never measurements.
  shape: z.enum(SHAPES).optional(),
  modules: z.array(moduleSchema).max(12).optional(),
  hplCodes: hplCodesSchema.optional(),
  // Official TACO catalogue data per normalized code (validated from taco.co.id).
  hplInfo: z.record(z.string().max(20), tacoInfoSchema).optional(),
  // Duco: workshop uploads a paint sample; colour is read from the photo pixels.
  ducoColor: z.string().trim().max(80).optional(),
  ducoHex: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  edge: z.enum(EDGES).optional(),
  handle: z.enum(HANDLES).optional(),
  glass: z.enum(GLASSES).optional(),
  lighting: z.enum(LIGHTINGS).optional(),
  // Jumlah titik lampu sorot/downlight (pcs), diisi desainer; hanya dipakai bila lampu mencakup sorot.
  spotlightCount: z.number().int().min(1).max(50).optional(),
  /** Number of separate LED strip runs (e.g. under upper cabinets + niche cove = 2). */
  ledRunCount: z.number().int().min(1).max(20).optional(),
  topLayers: z.enum(TOP_LAYERS).optional(),
  // Bahan top table: HPL TACO (pakai kode) atau granit (vendor batu, bukan HPL).
  topMaterial: z.enum(["hpl", "granite"]).optional(),
  accessoryMode: z.enum(["plain", "selected"]).optional(),
  // Master spec version: 1 = "Spek Final 1", n>1 = "Spek Revisi n-1".
  version: z.number().int().min(1).max(999).optional(),
});

export const specVersionLabel = (version: number | undefined) =>
  !version || version <= 1 ? "Spek Final 1" : `Spek Revisi ${version - 1}`;

/** Next version when saving: unchanged spec keeps its version, any change bumps it. */
export const nextSpecVersion = (
  saved: { version?: number | undefined } | undefined,
  changed: boolean,
) => (!saved ? 1 : changed ? (saved.version ?? 1) + 1 : (saved.version ?? 1));

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
  interiorSideAssetId: z.string().optional(),
  exteriorAssetId: z.string().optional(),
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
    { value: "pvc-board-18", label: "TACO PVC Board 18mm (TPB-18)" },
    { value: "eco-pvc-18", label: "TACO ECO PVC Board 18mm (ECB-18)" },
    { value: "multiplek-18", label: "Triplek / Multiplek 18mm" },
    { value: "blockboard-18", label: "Blockboard 18mm" },
    { value: "blockmin-1s-18", label: "Blockmin putih 1 sisi 18mm" },
    { value: "blockmin-2s-18", label: "Blockmin putih 2 sisi 18mm" },
    { value: "hybrid", label: "Hybrid (sink PVC Board, lainnya multiplek)" },
  ],
  outside: [
    { value: "hpl", label: "HPL" },
    { value: "hpl_premium", label: "HPL Premium / high gloss" },
    { value: "tacosheet", label: "TACO Sheet (PVC) — pakai kode" },
    { value: "duco", label: "Duco" },
  ],
  inside: [
    { value: "blockmin", label: "Blockmin putih polos" },
    { value: "tacosheet", label: "TACO Sheet" },
    { value: "hpl", label: "HPL" },
  ],
  hinge: [
    { value: "slowmo", label: "TACO ET-01 slowmotion (zinc)" },
    { value: "slowmo_stainless", label: "TACO ET-02 slowmotion stainless (area sink)" },
    { value: "biasa", label: "TACO ET-06 engsel biasa" },
  ],
  slide: [
    { value: "dt_slowmo", label: "TACO BBS 008 SC double track slowmo" },
    { value: "dt_biasa", label: "TACO BBS 006 FE double track biasa" },
    { value: "dt_eco", label: "TACO FE BBS 010 double track ekonomis" },
    { value: "push", label: "TACO BBS 009 PO push to open" },
    { value: "tandem", label: "TACO US 001 SC tandem slowmo" },
    { value: "roller", label: "TACO RLT roller putih" },
  ],
  edge: [
    { value: "edging", label: "Edging PVC TACO" },
    { value: "tusir", label: "Tusiran (tanpa edging)" },
    { value: "list_gold", label: "Edging + list aluminium gold" },
    { value: "list_chrome", label: "Edging + list stainless / chrome" },
    { value: "list_black", label: "Edging + list aluminium hitam doff" },
  ],
  topLayers: [
    { value: "2", label: "2 lapis bahan (tebal ±36mm)" },
    { value: "1", label: "1 lapis bahan (tebal 18mm)" },
  ],
  handle: [
    { value: "none", label: "Tanpa handle / bevel 45°" },
    { value: "profile_j", label: "Profil J aluminium" },
    { value: "push", label: "Push to open (magnet / tip-on)" },
    { value: "handle", label: "Handle tarikan luar" },
  ],
  glass: [
    { value: "none", label: "Tanpa kaca" },
    { value: "dark", label: "Kaca gelap (riben / smoke)" },
    { value: "clear", label: "Kaca bening" },
    { value: "fluted", label: "Kaca buram / fluted" },
  ],
  lighting: [
    { value: "none", label: "Tanpa lampu" },
    { value: "led", label: "LED strip + profil + trafo" },
    { value: "spot", label: "Lampu sorot kecil (spot)" },
    { value: "led_spot", label: "LED strip + lampu sorot" },
  ],
  glue: [
    { value: "active", label: "Lem kuning TACO Active" },
    { value: "starmax", label: "Lem kuning TACO Starmax" },
  ],
};

/** Kode HPL TACO, mis. "TH 825 NT" / "TACO TH-L 001 AA" — wajib ada nomor + huruf akhir (penentu harga). */
export function hasTacoHplCode(text: string): boolean {
  const c = text.toUpperCase().replace(/TACO|HPL/g, " ");
  return /\bTH[\s-]*L?[\s-]*\d{3,5}[\s-]*[A-Z]{1,3}\b/.test(c) || /\b\d{3,5}[\s-]*[A-Z]{1,3}\b/.test(c);
}

/** Yang belum diisi sebelum boleh dikirim ke SME (kosong = lengkap). */
export function missingForEstimate(spec: SpecHints | null | undefined): string[] {
  if (!spec) return ["Simpan dulu spek di Tampak dalam / spek material"];
  const miss: string[] = [];
  if (!spec.material) miss.push("Bahan bodi");
  if (!spec.glue) miss.push("Jenis lem (Active / Starmax)");
  const mods = spec.modules ?? [];
  if (!mods.length) miss.push("Daftar kabinet (modul)");
  miss.push(...missingFinalSpec(spec));
  if (spec.outside !== "duco" && !spec.hplCodes)
    for (const m of mods) if (!hasTacoHplCode(m.finish)) miss.push(`Kode HPL ${m.label}`);
  return miss;
}

/** Gerbang final spek: wajib lengkap sebelum generate tampak dalam & kirim SME. */
export function missingFinalSpec(spec: SpecHints): string[] {
  const miss: string[] = [];
  const c = spec.hplCodes;
  const unchecked = (code: string, label: string) => {
    if (hasTacoHplCode(code) && !tacoInfoFor(spec, code)) miss.push(`${label} belum dicek di katalog TACO`);
  };
  if (spec.outside !== "duco") {
    if (!c || !hasTacoHplCode(c.lower)) miss.push("Kode HPL kabinet bawah");
    if (c && !c.upperSame && !hasTacoHplCode(c.upper)) miss.push("Kode HPL kabinet atas");
    if (c) unchecked(c.lower, "Kode kabinet bawah");
    if (c && !c.upperSame) unchecked(c.upper, "Kode kabinet atas");
  } else if (!spec.ducoHex) miss.push("Foto sampel warna Duco");
  if (c && spec.topMaterial !== "granite") unchecked(c.top, "Kode top table");
  if (c?.hasAccent) unchecked(c.accent, "Kode aksen");
  if (spec.topMaterial !== "granite" && (!c || !hasTacoHplCode(c.top))) miss.push("Kode HPL top table");
  if (c?.hasAccent && !hasTacoHplCode(c.accent)) miss.push("Kode HPL aksen");
  if (!spec.topLayers) miss.push("Top table 1 / 2 lapis");
  if (!spec.edge) miss.push("Edging / tusiran");
  if (!spec.handle) miss.push("Handle");
  if (!spec.glass) miss.push("Kaca");
  if (!spec.lighting) miss.push("Lampu");
  if ((spec.lighting === "spot" || spec.lighting === "led_spot") && !spec.spotlightCount)
    miss.push("Jumlah titik lampu sorot");
  if ((spec.lighting === "led" || spec.lighting === "led_spot") && !spec.ledRunCount)
    miss.push("Jumlah jalur LED strip");
  if (!spec.accessoryMode) miss.push("Aksesori dalam: polos atau pakai aksesori");
  if (spec.accessoryMode === "selected" && !spec.accessories.length)
    miss.push("Centang minimal 1 aksesori");
  if (spec.accessories.some((a) => a.id === "hidrolik" && !a.doors))
    miss.push("Jumlah daun pintu angkat (hidrolik)");
  return miss;
}

export const ACCESSORIES = [
  { id: "rak-piring", label: "Rak piring" },
  { id: "rak-gelas", label: "Rak gelas" },
  { id: "rak-sayur", label: "Rak sayur tarik" },
  { id: "rak-bumbu", label: "Rak bumbu / botol" },
  { id: "tray-sendok", label: "Tray sendok" },
  { id: "keranjang-tarik", label: "Keranjang tarik bawah" },
  { id: "hidrolik", label: "Hidrolik pintu angkat (gas spring)" },
  { id: "ventilasi", label: "Kisi ventilasi hawa (tabung gas / sirkulasi)" },
] as const;

const optLabel = (key: keyof typeof SPEC_OPTIONS, value: string | undefined) =>
  SPEC_OPTIONS[key].find((o) => o.value === value)?.label ?? "";

/** Daftar HPL yang dibeli; kode sama digabung. Minimal 1 lembar utuh per kode. */
export function hplPurchaseList(codes: HplCodes | undefined) {
  if (!codes) return [];
  const parts: { part: string; code: string }[] = [
    { part: "Kabinet bawah", code: codes.lower },
    { part: "Kabinet atas", code: codes.upperSame ? codes.lower : codes.upper },
    { part: "Top table", code: codes.top },
    ...(codes.hasAccent ? [{ part: `Aksen${codes.accentNote ? ` (${codes.accentNote})` : ""}`, code: codes.accent }] : []),
  ];
  const map = new Map<string, string[]>();
  for (const p of parts) {
    const key = (p.code ?? "").trim().toUpperCase();
    if (!key) continue;
    map.set(key, [...(map.get(key) ?? []), p.part]);
  }
  return [...map.entries()].map(([code, used]) => ({ code, parts: used, minSheets: 1 }));
}

/** Rekap master spek untuk review workshop (tanpa jumlah lembar). */
export function specReviewRows(spec: SpecHints): { label: string; value: string }[] {
  const c = spec.hplCodes;
  const motifs = hplPurchaseList(c).map((x) => {
    const i = tacoInfoFor(spec, x.code);
    return `${x.code}${i ? ` (${i.name}, ${i.texture})` : ""} — ${x.parts.join(", ")}`;
  });
  const accessories =
    spec.accessoryMode === "plain"
      ? "Polos (hanya ambalan)"
      : spec.accessories
          .map((a) => `${ACCESSORIES.find((x) => x.id === a.id)?.label ?? a.id} (${a.position})`)
          .join(", ");
  return [
    { label: "Bentuk", value: spec.shape ? SHAPE_LABEL[spec.shape] : "" },
    { label: "Bahan bodi", value: optLabel("material", spec.material) },
    { label: "Finishing luar", value: optLabel("outside", spec.outside) },
    { label: `Motif HPL (${motifs.length})`, value: motifs.join("\n") },
    { label: "Finishing dalam", value: optLabel("inside", spec.inside) },
    { label: "Top table", value: spec.topMaterial === "granite" ? "Granit (vendor batu, bukan HPL)" : optLabel("topLayers", spec.topLayers) },
    { label: "Pinggiran", value: optLabel("edge", spec.edge) },
    { label: "Handle", value: optLabel("handle", spec.handle) },
    { label: "Kaca", value: optLabel("glass", spec.glass) },
    { label: "Lampu", value: optLabel("lighting", spec.lighting) },
    { label: "Engsel", value: optLabel("hinge", spec.hinge) },
    { label: "Rel laci", value: optLabel("slide", spec.slide) },
    { label: "Lem HPL", value: optLabel("glue", spec.glue) },
    { label: "Aksesori dalam", value: accessories },
  ];
}


/** Countertop follows the spec, never the reference photo's stone/colour. */
export function countertopRule(spec: SpecHints): string {
  if (spec.topMaterial === "granite") return "COUNTERTOP: polished black granite stone slab (natural stone, not HPL).";
  const top = spec.hplCodes?.top?.trim();
  return top
    ? `COUNTERTOP (STRICT): the countertop is HPL ${tacoDesc(spec, top)} laminate on board, NOT granite, NOT marble, NOT stone. Replace any granite/stone countertop in IMAGE 1 with this HPL colour and pattern.`
    : "";
}

/** Cabinet finish lock: the spec (official TACO data / Duco sample) overrides IMAGE 1 colours. */
export function frontsRule(spec: SpecHints): string {
  const c = spec.hplCodes;
  if (spec.outside === "duco") {
    return spec.ducoHex
      ? `FINISH RULE (STRICT): all cabinet fronts and visible side panels are smooth spray-painted DUCO lacquer in colour ${spec.ducoHex}${spec.ducoColor ? ` (${spec.ducoColor})` : ""}, no woodgrain, no HPL pattern. Recolour IMAGE 1's cabinets to this exact colour.`
      : "";
  }
  if (!c) return "";
  const upper = c.upperSame ? c.lower : c.upper;
  const kind = spec.outside === "tacosheet" ? "TACO Sheet (PVC)" : "HPL";
  return [
    `FINISH RULE (STRICT, overrides IMAGE 1 colours): base cabinet fronts and side panels = ${kind} ${tacoDesc(spec, c.lower)}; upper cabinet fronts = ${kind} ${tacoDesc(spec, upper)}.`,
    c.hasAccent && c.accent ? `Accent parts (${c.accentNote || "accent panels"}) = HPL ${tacoDesc(spec, c.accent)}.` : "",
    "Reproduce each official TACO motif's real colour and texture (woodgrain direction, solid colour, stone or pattern) faithfully. Change ONLY the surface finish; never change shape, size, modules or anything else.",
  ].filter(Boolean).join(" ");
}

/** Final closed-door exterior: IMAGE 1 geometry locked, only spec-visible finishes applied. */
export function buildExteriorPrompt(spec: SpecHints, note = ""): string {
  const c = spec.hplCodes;
  const upper = c ? (c.upperSame ? c.lower : c.upper) : "";
  return [
    "IMAGE 1 is the client's approved After render. Produce ONE photorealistic FINAL EXTERIOR view (all doors closed) from exactly the same camera, framing, perspective and aspect ratio.",
    "LOCK everything in IMAGE 1: room walls, tiles, ceiling, floor, windows, room lights, appliances, sink, objects, cabinet length, height, module count, door split, open niches and positions. Never resize, add or remove modules, never extend to the ceiling unless IMAGE 1 already does.",
    "ONLY update the visible cabinet finishes so they match this final material specification:",
    frontsRule(spec),
    countertopRule(spec),
    spec.topLayers ? `Countertop front edge: ${spec.topLayers === "2" ? "thick double layer (about 36mm)" : "single 18mm"}.` : "",
    spec.edge ? `Door edges: ${optLabel("edge", spec.edge)}.` : "",
    spec.handle ? `Handles: ${optLabel("handle", spec.handle)}.` : "",
    spec.glass ? (spec.glass === "none" ? "No glass doors: glass panels become solid doors in the same finish." : `Glass: ${optLabel("glass", spec.glass)} — only on doors that already have glass in IMAGE 1 (or where the note says).`) : "",
    spec.lighting ? (spec.lighting === "none" ? "No built-in cabinet lights." : `Built-in cabinet lights: ${optLabel("lighting", spec.lighting)}, switched on, warm white, placed under the upper cabinets / in the cabinet crown.`) : "",
    "Do not invent decorations, trims, vents, shelves or objects not listed here. Do not label dimensions.",
    note ? `Workshop note (positions/extra): ${note}` : "",
  ].filter(Boolean).join("\n");
}

/** TACO runner appearance: BBS double-track = matte black side-mount; RLT roller = white; tandem = hidden undermount. */
export function slideLook(slide: SpecHints["slide"]): string {
  if (slide === "tandem")
    return "Drawer runners are TACO tandem UNDERMOUNT: hidden under the drawer bottom, so the drawer box sides are clean plain panels with NO visible side-mounted rail; never draw side rails.";
  if (slide === "roller")
    return "Drawer runners are TACO RLT standard roller rails in WHITE epoxy, mounted on the drawer sides; never chrome or black.";
  return "Drawer runners are TACO BBS ball-bearing double-track rails in MATTE BLACK steel, mounted on the drawer sides; never chrome, silver or white.";
}

export function buildInteriorPrompt(spec: SpecHints, note = "", angle: "front" | "side" = "front"): string {
  // Never build an interior prompt without a FRONT BLUEPRINT.
  const gate = validateInteriorBlueprint(spec.frontLayout);
  if (!gate.valid) throw new Error(gate.error);
  const label = (key: keyof typeof SPEC_OPTIONS, value: string) =>
    SPEC_OPTIONS[key].find((o) => o.value === value)?.label ?? value;
  const camera =
    angle === "side"
      ? "Create ONE additional photorealistic open-door interior view from a THREE-QUARTER (about 35-45 degree) oblique wide-angle camera standing at one end of the kitchen set, same aspect ratio. This angle exists for hardware QC: clearly show the side panels of the cabinets, the drawer boxes pulled far out with their runners visible on the drawer sides or underneath, door hinges (cup hinges on the inside of each open door), and any lift/gas-spring mechanism on upper flap doors."
      : "Create ONE additional photorealistic open-door interior view from a frontal WIDE-ANGLE camera with the same framing centre and aspect ratio, slightly wider so the whole cabinet run is visible. This angle exists for module QC: clearly show every shelf, vertical divider, rack and drawer inside.";
  return [
    "IMAGE 1 is the client's selected finished After render, the immutable exterior design reference.",
    camera,
    "LOCK the cabinet carcass dimensions, module count, positions, outside colours, outside HPL grain, materials, handles, countertop, sink, appliances, walls, ceiling, floor and lighting. Never resize, remove, redesign or add cabinet modules. No full-ceiling extension.",
    "1:1 FRONT MAPPING: every closed front panel in IMAGE 1 (an area bounded by visible gap lines) becomes exactly ONE leaf in the open view, hinged on its own outer edge; only fronts listed as a pair open outward from their shared centre gap. Never split a front, never add a front, never merge fronts, never add a filler or narrow extra leaf. Upper fronts stacked in two rows stay two rows of separate leaves over the same number of bays. Drawers stay drawers, pulled out.",
    layoutPrompt(spec.frontLayout),
    "OPEN ANGLE: swing every leaf only about 60 degrees so each open leaf stays clearly attached to its own opening and never covers a neighbouring opening. Behind every open leaf show only its own compartment interior (shelves, dividers), never another door.",
    `Selected outside specification: ${label("outside", spec.outside)}; keep the outside finishes exactly as the FINISH RULE below. Selected interior finish: ${label("inside", spec.inside)}. Hinge: ${label("hinge", spec.hinge)}. Drawer runners: ${label("slide", spec.slide)}. ${slideLook(spec.slide)} Show realistic shelving inside existing modules.`,
    [
      countertopRule(spec),
      spec.topLayers ? `Countertop thickness: ${spec.topLayers === "2" ? "thick double-layer slab (about 36mm front edge)" : "single-layer slab (18mm)"}.` : "",
      spec.edge?.startsWith("list_") ? `Thin decorative ${spec.edge === "list_gold" ? "gold" : spec.edge === "list_chrome" ? "polished chrome / stainless" : "matte black"} aluminium trim lines on door/frame edges exactly where visible in IMAGE 1; never add new trim.` : "",
      spec.handle ? `Handles: ${optLabel("handle", spec.handle)}.` : "",
      spec.glass && spec.glass !== "none"
        ? `Glass doors exactly as in IMAGE 1, glass type: ${optLabel("glass", spec.glass)}; keep glass where IMAGE 1 has it, never add new glass doors.`
        : "",
      spec.lighting ? `Lighting: ${optLabel("lighting", spec.lighting)}; keep exactly as visible in IMAGE 1.` : "",
      frontsRule(spec),
    ].join(" "),
    spec.accessories.length
      ? `ONLY these selected accessories, in exactly these workshop-specified positions: ${spec.accessories.map((a) => `${ACCESSORIES.find((x) => x.id === a.id)?.label}: ${a.position}`).join("; ")}.${spec.accessories.some((a) => a.id === "ventilasi") ? " Ventilation grille = a small slatted aluminium louver vent on that base cabinet door or plinth." : ""} Do not add any unselected accessory, and never draw a ventilation grille unless it is selected.`
      : "No accessory inserts are selected. Show plain shelves only; no ventilation grilles, no dish racks, vegetable pullouts, spice inserts or cutlery trays.",
    "Positions count cabinet modules from the viewer's left unless explicitly specified otherwise. Keep every accessory inside its existing cabinet footprint. Do not fabricate measurements or label inferred dimensions.",
    note ? `Workshop clarification, subordinate to the exterior design locks: ${note}` : "",
    "Output one photo, no collage, no dimension text, no annotations, no watermark. This is a visual concept, not a measured production drawing.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** SME contract (1 Jalur, full TACO): explicit name/category per module + brand fields. */
const SME_BODY: Record<(typeof MATERIALS)[number], string> = {
  "pvc-board-18": "pvc",
  "eco-pvc-18": "pvc_eco",
  "multiplek-18": "ply",
  "blockboard-18": "blockboard",
  "blockmin-1s-18": "blockmin_1s",
  "blockmin-2s-18": "blockmin_2s",
  hybrid: "hybrid",
};
const HINGE_CODE = { slowmo: "ET-01", slowmo_stainless: "ET-02", biasa: "ET-06" } as const;
function smeHplFields(c: HplCodes | undefined, info?: SpecHints["hplInfo"]) {
  if (!c) return { hplMotifs: [] as { code: string; usage: string; isWorkshopHpl: true; name?: string; texture?: string; swatchUrl?: string }[] };
  const outside = c.lower.trim();
  const upper = c.upperSame ? outside : c.upper.trim();
  const top = c.top.trim();
  const accent = c.hasAccent ? c.accent.trim() : "";
  const motifs = [
    { code: outside, usage: "kabinet" },
    ...(upper && upper.toUpperCase() !== outside.toUpperCase() ? [{ code: upper, usage: "kabinet_atas" }] : []),
    { code: top, usage: "top" },
    { code: accent, usage: "aksen" },
  ]
    .filter((m) => m.code)
    .map((m) => {
      const i = info?.[normTacoCode(m.code)];
      // isWorkshopHpl: marble/stone-look HPL is still a TACO sheet, never natural stone.
      const base = { ...m, isWorkshopHpl: true as const };
      return i ? { ...base, name: i.name, texture: i.texture, ...(i.image ? { swatchUrl: i.image } : {}) } : base;
    });
  return {
    hplOutside: outside || undefined,
    hplUpper: upper || undefined,
    hplTop: top || undefined,
    hplAccent: accent || undefined,
    hplMotifs: motifs,
  };
}
/**
 * SME `finishExtras`. Only facts KIS owns: qty null = SME counts from the survey/scan
 * (KIS never guesses door counts, LED metres or spot points).
 */
export function smeFinishExtras(spec: SpecHints) {
  const glass = spec.glass && spec.glass !== "none" ? spec.glass : undefined;
  const led = spec.lighting === "led" || spec.lighting === "led_spot";
  const spot = spec.lighting === "spot" || spec.lighting === "led_spot";
  const lift = spec.accessories.filter((a) => a.id === "hidrolik");
  const liftDoors = lift.reduce((n, a) => n + (a.doors ?? 0), 0);
  return {
    // Glass door frames are workshop plywood + HPL (accent code), never a separate aluminium profile.
    glassDoors: glass
      ? { type: glass, frame: "wood_hpl", hplCode: (spec.hplCodes?.hasAccent && spec.hplCodes.accent.trim()) || undefined, qty: null }
      : { type: "none", qty: 0 },
    gasSprings: lift.length ? { doors: liftDoors, qty: liftDoors * 2, unit: "pcs" } : { doors: 0, qty: 0, unit: "pcs" },
    // qty = exact number of strip runs (audit compares exactly); meters come from SME measuring.
    ledRun: led ? { qty: spec.ledRunCount ?? null, meters: null, transformers: null } : { qty: 0, meters: 0, transformers: 0 },
    spotlights: spot ? { qty: spec.spotlightCount ?? null } : { qty: 0 },
  };
}
export function toSmeSpec(spec: SpecHints) {
  const cat = { lower: "kitchen-base", upper: "kitchen-upper", tall: "kitchen-tall" } as const;
  return {
    ...spec,
    brand: "TACO",
    material: spec.material ?? "pvc-board-18",
    // SME vocab: body ply|blockboard|blockmin_1s|blockmin_2s|pvc|pvc_eco|hybrid.
    body: SME_BODY[spec.material ?? "pvc-board-18"],
    hardware: HINGE_CODE[spec.hinge],
    drawerSlide: spec.slide,
    glue: spec.glue,
    edge: spec.edge,
    handle: spec.handle,
    glass: spec.glass,
    lighting: spec.lighting,
    topLayers: spec.topLayers === "1" ? 1 : spec.topLayers === "2" ? 2 : undefined,
    // Tiap kode HPL berbeda dibeli minimal 1 lembar utuh walau dipakai sedikit.
    hplSheets: hplPurchaseList(spec.hplCodes),
    // SME 1:1 field names. Codes are sent as written; SME must not replace them.
    ...smeHplFields(spec.hplCodes, spec.hplInfo),
    // "single" (18mm) belum ada di SME: SME wajib menambah, jangan dianggap "none".
    topMaterial: spec.topMaterial ?? "hpl",
    top: spec.topMaterial === "granite" ? "none" : spec.topLayers === "2" ? "double" : spec.topLayers === "1" ? "single" : undefined,
    ...(spec.topMaterial === "granite" ? { hplTop: undefined } : {}),
    accessories: spec.accessories.map((a) =>
      a.id === "hidrolik"
        ? { id: "gas-spring", position: a.position, doors: a.doors, qty: (a.doors ?? 0) * 2, unit: "pcs" }
        : { id: a.id, position: a.position, qty: 1 },
    ),
    modules: (spec.modules ?? []).map((m) => ({ ...m, name: m.label, category: cat[m.level] })),
    finishExtras: smeFinishExtras(spec),
  };
}

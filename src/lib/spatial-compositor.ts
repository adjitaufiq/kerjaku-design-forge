/**
 * Tahap 2.5 — Protected Pixel Restoration Engine. ISOLATED — not wired into any generator.
 *
 * I_final(x,y) = I_ai(x,y)       if zone ∈ {cavity, corridor}
 *              = I_original(x,y) if zone ∈ {outside, carcass}
 *
 * No resize, crop, interpolation or lossy step: buffers are copied byte-for-byte.
 * Pixel restoration proves protected pixels are exact; it does NOT prove the door
 * leaf, hinges or handle are complete. `analyzeEditBoundary` only flags clipping risk.
 */
import { ZONE, type MaskZone } from "./spatial-mask";

export type RgbaImage = { width: number; height: number; data: Uint8Array | Uint8ClampedArray };

const EDITABLE = (z: number | undefined) => z === ZONE.cavity || z === ZONE.corridor;

export class CompositorError extends Error {}

function assertImage(name: string, img: RgbaImage, width: number, height: number) {
  if (!img || !(img.data instanceof Uint8Array || img.data instanceof Uint8ClampedArray))
    throw new CompositorError(`${name}: buffer tidak valid`);
  if (img.width !== width || img.height !== height)
    throw new CompositorError(`${name}: dimensi ${img.width}x${img.height} ≠ ${width}x${height}`);
  if (img.data.length !== width * height * 4)
    throw new CompositorError(`${name}: panjang buffer ${img.data.length} ≠ ${width * height * 4} (RGBA)`);
}

export function validateInputs(original: RgbaImage, ai: RgbaImage, zones: Uint8Array, width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
    throw new CompositorError("dimensi tidak valid");
  assertImage("original", original, width, height);
  assertImage("ai", ai, width, height);
  if (!(zones instanceof Uint8Array)) throw new CompositorError("mask: buffer tidak valid");
  if (zones.length !== width * height) throw new CompositorError(`mask: panjang ${zones.length} ≠ ${width * height}`);
  for (let i = 0; i < zones.length; i++)
    if (zones[i]! > 3) throw new CompositorError(`mask: zona tidak terdefinisi (${zones[i]}) pada pixel ${i}`);
}

export function compositeProtectedPixels(
  original: RgbaImage,
  ai: RgbaImage,
  zones: Uint8Array,
  width: number,
  height: number,
): RgbaImage {
  validateInputs(original, ai, zones, width, height);
  const out = new Uint8Array(width * height * 4);
  for (let p = 0; p < zones.length; p++) {
    const src = EDITABLE(zones[p]) ? ai.data : original.data;
    const o = p * 4;
    out[o] = src[o]!;
    out[o + 1] = src[o + 1]!;
    out[o + 2] = src[o + 2]!;
    out[o + 3] = src[o + 3]!;
  }
  return { width, height, data: out };
}

export type ChannelStats = { r: number; g: number; b: number; a: number };
export type RegionAudit = {
  pixels: number;
  changedPixels: number;
  identicalPct: number;
  mae: number; // mean absolute error over all RGBA channels
  maeByChannel: ChannelStats;
  maxDiffByChannel: ChannelStats;
};
export type CompositingAudit = {
  protectedVsOriginal: { all: RegionAudit; outside: RegionAudit; carcass: RegionAudit };
  /** AI drift before restoration (what the model changed in protected zones). */
  aiDriftProtected: RegionAudit;
  /** Editable pixels must equal AI output exactly (no clipping by the compositor). */
  editableVsAi: RegionAudit;
  pass: boolean;
};

function regionAudit(a: RgbaImage["data"], b: RgbaImage["data"], zones: Uint8Array, pick: (z: number) => boolean): RegionAudit {
  let pixels = 0, changed = 0;
  const sum = [0, 0, 0, 0], max = [0, 0, 0, 0];
  for (let p = 0; p < zones.length; p++) {
    if (!pick(zones[p]!)) continue;
    pixels++;
    let diff = false;
    for (let c = 0; c < 4; c++) {
      const d = Math.abs(a[p * 4 + c]! - b[p * 4 + c]!);
      if (d) diff = true;
      sum[c] = sum[c]! + d;
      if (d > max[c]!) max[c] = d;
    }
    if (diff) changed++;
  }
  const n = pixels || 1;
  const ch = (v: number[]): ChannelStats => ({ r: v[0]!, g: v[1]!, b: v[2]!, a: v[3]! });
  return {
    pixels,
    changedPixels: changed,
    identicalPct: pixels ? ((pixels - changed) / pixels) * 100 : 100,
    mae: (sum[0]! + sum[1]! + sum[2]! + sum[3]!) / (n * 4),
    maeByChannel: ch(sum.map((s) => s / n)),
    maxDiffByChannel: ch(max),
  };
}

export function auditCompositingQuality(
  original: RgbaImage,
  ai: RgbaImage,
  final: RgbaImage,
  zones: Uint8Array,
  width: number,
  height: number,
): CompositingAudit {
  validateInputs(original, ai, zones, width, height);
  assertImage("final", final, width, height);
  const prot = (z: number) => !EDITABLE(z);
  const all = regionAudit(original.data, final.data, zones, prot);
  const outside = regionAudit(original.data, final.data, zones, (z) => z === ZONE.outside);
  const carcass = regionAudit(original.data, final.data, zones, (z) => z === ZONE.carcass);
  const editableVsAi = regionAudit(ai.data, final.data, zones, EDITABLE);
  return {
    protectedVsOriginal: { all, outside, carcass },
    aiDriftProtected: regionAudit(original.data, ai.data, zones, prot),
    editableVsAi,
    pass: all.changedPixels === 0 && all.mae === 0 && editableVsAi.changedPixels === 0,
  };
}

export type BoundaryAnalysis = {
  boundaryPixels: number;
  /** Protected pixels on the edit boundary where AI drew something different (content cut off). */
  clippedContentPixels: number;
  clippedPct: number;
  verdict: "NO_CLIPPING_SIGNAL" | "CLIPPING_RISK";
};

/**
 * Clipping heuristic: if the AI changed protected pixels that touch the editable zone,
 * the drawn door/hinge/handle probably extends beyond the mask and will be cut by restoration.
 * This is a signal, not proof of visual correctness (hinges/handle/extra doors need visual QC).
 */
export function analyzeEditBoundary(
  original: RgbaImage,
  ai: RgbaImage,
  zones: Uint8Array,
  width: number,
  height: number,
  opts: { threshold?: number; maxClippedPct?: number } = {},
): BoundaryAnalysis {
  validateInputs(original, ai, zones, width, height);
  const threshold = opts.threshold ?? 24;
  const maxPct = opts.maxClippedPct ?? 0.5;
  let boundary = 0, clipped = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (EDITABLE(zones[p])) continue;
      const nb = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1];
      if (!nb.some((q) => q >= 0 && EDITABLE(zones[q]))) continue;
      boundary++;
      let d = 0;
      for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(original.data[p * 4 + c]! - ai.data[p * 4 + c]!));
      if (d > threshold) clipped++;
    }
  const clippedPct = boundary ? (clipped / boundary) * 100 : 0;
  return { boundaryPixels: boundary, clippedContentPixels: clipped, clippedPct, verdict: clippedPct > maxPct ? "CLIPPING_RISK" : "NO_CLIPPING_SIGNAL" };
}

/** Binary white-is-edit mask → zone map (editable → cavity, protected → outside). */
export function zonesFromBinaryMask(gray: Uint8Array, threshold = 128): Uint8Array {
  const z = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) z[i] = gray[i]! >= threshold ? ZONE.cavity : ZONE.outside;
  return z;
}

export type { MaskZone };

import type { GeometryFrame, NormalizedRect, Point2D, SpatialGeometry } from "./spatial-geometry";

/**
 * Masking semantics (Phase 2, Tahap 2). ISOLATED EXPERIMENT — not wired into any generator.
 *
 * Three zones per frame:
 *  - carcass  : inside the frame, outside every editable opening → PROTECTED
 *  - cavity   : opening of a cell whose fronts all have verified geometry → EDITABLE
 *  - corridor : projected open polygon of a verified leaf → EDITABLE
 *  - outside  : everything outside the frame (wall, floor, worktop) → PROTECTED
 *
 * Fail-safe rules:
 *  - A cell with any leaf whose hinge is unverified (openPolygon null) is fully protected.
 *  - Carcass always wins over an editable zone (overlaps are counted as conflicts).
 *  - Pixels are sampled at their centre and are strictly binary (no anti-aliasing).
 */

export type MaskZone = 0 | 1 | 2 | 3; // 0 outside, 1 carcass, 2 cavity, 3 corridor
export const ZONE = { outside: 0, carcass: 1, cavity: 2, corridor: 3 } as const;

/**
 * Endpoint alpha semantics. Must be confirmed against the real endpoint before production use.
 *  - "transparent_is_edit": alpha 0 = edit, alpha 255 = keep (OpenAI images/edits style).
 *  - "white_is_edit": opaque image, white = edit, black = keep (white-on-black masks).
 */
export type MaskSemantics = "transparent_is_edit" | "white_is_edit";

export type ZoneMap = {
  width: number;
  height: number;
  zones: Uint8Array;
  /** Pixels where an editable zone overlapped the carcass and were forced protected. */
  conflicts: number;
  protectedCells: string[];
};

const inRect = (p: Point2D, r: NormalizedRect) => p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;

function inPolygon(p: Point2D, poly: Point2D[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

export function buildZoneMap(
  geometry: SpatialGeometry,
  frame: GeometryFrame,
  width: number,
  height: number,
  opts: { edgeInsetPx?: number } = {},
): ZoneMap {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
    throw new Error("Ukuran mask harus bilangan bulat positif");
  if (frame.camera.kind !== "orthographic_front")
    throw new Error("Tahap 2 hanya mendukung kamera orthographic_front");
  const owner = frame.ownerId;
  const leaves = geometry.leaves.filter((l) => l.ownerId === owner);
  const cells = geometry.cells.filter((c) => c.ownerId === owner);
  const protectedCells: string[] = [];
  const cavities: NormalizedRect[] = [];
  const corridors: Point2D[][] = [];

  for (const c of cells) {
    const ls = leaves.filter((l) => l.parentCellId === c.cellId);
    const ds = geometry.drawers.filter((d) => d.parentCellId === c.cellId && d.ownerId === owner);
    if (!ls.length && !ds.length) {
      protectedCells.push(c.cellId); // open niche / no front: nothing to open
      continue;
    }
    if (ls.some((l) => !l.openPolygon)) {
      protectedCells.push(c.cellId);
      continue;
    }
    // Opening = union of the closed fronts (cell rect minus the measured gap).
    for (const l of ls) cavities.push(l.closedBounds);
    for (const d of ds) cavities.push(d.closedBounds);
    for (const l of ls) corridors.push(l.openPolygon!);
  }

  const zones = new Uint8Array(width * height);
  let conflicts = 0;
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const p = { x: (px + 0.5) / width, y: (py + 0.5) / height };
      const inFrame = p.x >= 0 && p.x < 1 && p.y >= 0 && p.y < 1; // ortho: frame fills image
      if (!inFrame) continue;
      const cav = cavities.some((r) => inRect(p, r));
      const cor = corridors.some((q) => inPolygon(p, q));
      let z: MaskZone = ZONE.carcass;
      if (cor && !cav) conflicts++; // corridor outside its opening would bleed into carcass
      else if (cor) z = ZONE.corridor;
      else if (cav) z = ZONE.cavity;
      zones[py * width + px] = z;
    }

  const inset = Math.max(0, Math.floor(opts.edgeInsetPx ?? 0));
  if (inset > 0) {
    // Erode editable zones away from protected pixels: a safety band against seam artifacts.
    const src = zones.slice();
    for (let py = 0; py < height; py++)
      for (let px = 0; px < width; px++) {
        const i = py * width + px;
        if (src[i]! < ZONE.cavity) continue;
        outer: for (let dy = -inset; dy <= inset; dy++)
          for (let dx = -inset; dx <= inset; dx++) {
            const x = px + dx;
            const y = py + dy;
            if (x < 0 || y < 0 || x >= width || y >= height || src[y * width + x]! < ZONE.cavity) {
              zones[i] = ZONE.carcass;
              break outer;
            }
          }
      }
  }
  return { width, height, zones, conflicts, protectedCells };
}

export const isEditable = (z: number) => z === ZONE.cavity || z === ZONE.corridor;

// ---------------------------------------------------------------------------
// Tahap 2.5 fix — physical swing envelope (replaces the thin corridor quad).
// The old corridor was only the projected leaf plane at one angle, clipped to the
// cavity. An opened leaf is foreground: its thickness, hinge knuckle, handle and
// shadow project OVER the carcass, so they were cut by pixel restoration.
// The envelope is derived only from the calibrated openPolygon + declared physical
// tolerances (mm); nothing is fitted to the AI output.
// ---------------------------------------------------------------------------
export type SwingEnvelopeSpec = {
  /** Frame size used to convert mm → normalized units. */
  frameWidthMm: number;
  frameHeightMm: number;
  leafThicknessMm: number;
  handleProtrusionMm: number;
  hingeMarginMm: number;
  shadowToleranceMm: number;
  /** ± tolerance around the calibrated opening angle (model may open a bit more/less). */
  angleToleranceDeg: number;
  angleSamples?: number;
  /**
   * Multiplier on the calibrated perspective flare of the free edge (default 1 = strict).
   * Only for uncalibrated cameras; must be declared and reported, never tuned silently.
   */
  flareTolerance?: number;
};

type P = Point2D;
function convexHull(pts: P[]): P[] {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: P[] = [];
  for (const p of s) {
    while (lo.length >= 2 && cr(lo[lo.length - 2]!, lo[lo.length - 1]!, p) <= 0) lo.pop();
    lo.push(p);
  }
  const up: P[] = [];
  for (const p of [...s].reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2]!, up[up.length - 1]!, p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/**
 * Envelope polygon of an open swing/lift leaf. quad = [hingeStart, freeStart, freeEnd, hingeEnd].
 * leafExtent = closed leaf size along the swing axis (normalized; width for swing, height for lift-up).
 */
export function buildSwingEnvelope(
  quad: [P, P, P, P],
  swing: "outward_left" | "outward_right" | "upward",
  leafExtent: number,
  spec: SwingEnvelopeSpec,
): P[] {
  const vertical = swing === "upward";
  // Work in (u = swing axis, v = hinge axis); map back at the end.
  const toUV = (p: P) => (vertical ? { u: p.y, v: p.x } : { u: p.x, v: p.y });
  const mmU = 1 / (vertical ? spec.frameHeightMm : spec.frameWidthMm);
  const mmV = 1 / (vertical ? spec.frameWidthMm : spec.frameHeightMm);
  const [h0, f0, f1, h1] = quad.map(toUV) as [{ u: number; v: number }, { u: number; v: number }, { u: number; v: number }, { u: number; v: number }];
  const uh = (h0.u + h1.u) / 2;
  const uf = (f0.u + f1.u) / 2;
  const s = Math.sign(uf - uh) || (swing === "outward_left" || swing === "upward" ? -1 : 1);
  const vLo = Math.min(h0.v, h1.v), vHi = Math.max(h0.v, h1.v);
  const flareLo = Math.max(0, vLo - Math.min(f0.v, f1.v));
  const flareHi = Math.max(0, Math.max(f0.v, f1.v) - vHi);
  const W = Math.max(leafExtent, Math.abs(uf - uh));
  const th0 = Math.acos(Math.min(1, Math.abs(uf - uh) / W));
  const depth0 = W * Math.sin(th0);
  const ft = Math.max(1, spec.flareTolerance ?? 1);
  const kLo = depth0 > 1e-9 ? (ft * flareLo) / depth0 : 0;
  const kHi = depth0 > 1e-9 ? (ft * flareHi) / depth0 : 0;
  const tol = (spec.angleToleranceDeg * Math.PI) / 180;
  const n = Math.max(2, spec.angleSamples ?? 9);
  const outU = (spec.leafThicknessMm + spec.handleProtrusionMm + spec.shadowToleranceMm) * mmU;
  const shV = (spec.shadowToleranceMm + spec.leafThicknessMm) * mmV;
  const pts: { u: number; v: number }[] = [];
  // Hinge side: knuckle/cup margin back toward the cavity, full height + shadow.
  const hu = uh - s * spec.hingeMarginMm * mmU;
  pts.push({ u: hu, v: vLo - shV }, { u: hu, v: vHi + shV }, { u: uh, v: vLo - shV }, { u: uh, v: vHi + shV });
  for (let i = 0; i < n; i++) {
    const th = Math.max(0, Math.min(Math.PI / 2, th0 - tol + (2 * tol * i) / (n - 1)));
    const d = W * Math.sin(th);
    const u = uh + s * W * Math.cos(th);
    const lo = vLo - kLo * d - shV, hi = vHi + kHi * d + shV;
    // free edge + leaf thickness + handle + shadow (outward along the swing axis)
    pts.push({ u, v: lo }, { u, v: hi }, { u: u + s * outU, v: lo }, { u: u + s * outU, v: hi });
  }
  return convexHull(pts.map(({ u, v }) => (vertical ? { x: v, y: u } : { x: u, y: v })));
}

/** Point-in-polygon for arbitrary polygons (exported for tests/evidence). */
export const pointInPolygon = (p: Point2D, poly: Point2D[]) => inPolygon(p, poly);

/**
 * Zone map with physical swing envelopes. Envelopes are foreground (in front of the frame),
 * so they override carcass instead of being counted as conflicts. Unverified-hinge cells and
 * open niches stay fully protected, exactly like buildZoneMap.
 */
export function buildEnvelopeZoneMap(
  geometry: SpatialGeometry,
  frame: GeometryFrame,
  width: number,
  height: number,
  spec: Omit<SwingEnvelopeSpec, "frameWidthMm" | "frameHeightMm">,
): ZoneMap & { envelopes: { leafId: string; polygon: Point2D[] }[] } {
  const base = buildZoneMap(geometry, frame, width, height);
  const full = { ...spec, frameWidthMm: frame.widthMm, frameHeightMm: frame.heightMm };
  const envelopes: { leafId: string; polygon: Point2D[] }[] = [];
  for (const l of geometry.leaves) {
    if (l.ownerId !== frame.ownerId || !l.openPolygon || !l.swingDirection) continue;
    if (base.protectedCells.includes(l.parentCellId)) continue;
    const ext = l.swingDirection === "upward" ? l.closedBounds.height : l.closedBounds.width;
    envelopes.push({ leafId: l.leafId, polygon: buildSwingEnvelope(l.openPolygon, l.swingDirection, ext, full) });
  }
  const zones = base.zones;
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const i = py * width + px;
      if (zones[i] === ZONE.cavity) continue;
      const p = { x: (px + 0.5) / width, y: (py + 0.5) / height };
      if (envelopes.some((e) => inPolygon(p, e.polygon))) zones[i] = ZONE.corridor;
    }
  return { ...base, zones, conflicts: 0, envelopes };
}

/**
 * Inner-only feather: weight 0..1 for editable pixels, ramping from the protected boundary
 * inward over bandPx (chebyshev distance). Protected pixels always have weight 0.
 */
export function innerFeatherWeights(zones: Uint8Array, width: number, height: number, bandPx: number): Float32Array {
  const w = new Float32Array(width * height);
  const dist = new Int32Array(width * height).fill(-1);
  let q: number[] = [];
  for (let i = 0; i < zones.length; i++) if (!isEditable(zones[i]!)) { dist[i] = 0; q.push(i); }
  while (q.length) {
    const nx: number[] = [];
    for (const i of q) {
      const x = i % width, y = (i / width) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= width || Y >= height) continue;
          const j = Y * width + X;
          if (dist[j]! >= 0) continue;
          dist[j] = dist[i]! + 1;
          nx.push(j);
        }
    }
    q = nx;
  }
  for (let i = 0; i < w.length; i++) {
    if (!isEditable(zones[i]!)) continue;
    const d = dist[i]! < 0 ? Infinity : dist[i]!;
    w[i] = bandPx <= 0 ? 1 : Math.min(1, d / (bandPx + 1));
  }
  return w;
}

/** Blend composite toward original ONLY inside the edit zone; protected pixels are copied from original. */
export function applyInnerFeather(original: Uint8Array, composite: Uint8Array, zones: Uint8Array, weights: Float32Array): Uint8Array {
  const out = new Uint8Array(original.length);
  for (let i = 0; i < zones.length; i++) {
    const o = i * 4;
    if (!isEditable(zones[i]!)) { out.set(original.subarray(o, o + 4), o); continue; }
    const a = weights[i]!;
    for (let c = 0; c < 4; c++) out[o + c] = Math.round(original[o + c]! * (1 - a) + composite[o + c]! * a);
  }
  return out;
}

/** RGBA mask buffer with the requested endpoint semantics. Values are strictly 0 or 255. */
export function zoneMapToRgba(map: ZoneMap, semantics: MaskSemantics): Uint8Array {
  const out = new Uint8Array(map.width * map.height * 4);
  for (let i = 0; i < map.zones.length; i++) {
    const edit = isEditable(map.zones[i]!);
    const o = i * 4;
    if (semantics === "transparent_is_edit") {
      out[o] = out[o + 1] = out[o + 2] = 0;
      out[o + 3] = edit ? 0 : 255;
    } else {
      out[o] = out[o + 1] = out[o + 2] = edit ? 255 : 0;
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Colour overlay for human review: grey outside, red carcass, blue cavity, green corridor. */
export function zoneMapToOverlay(map: ZoneMap): Uint8Array {
  const pal: Record<number, [number, number, number]> = {
    0: [60, 60, 60],
    1: [200, 40, 40],
    2: [40, 90, 220],
    3: [40, 190, 80],
  };
  const out = new Uint8Array(map.width * map.height * 4);
  map.zones.forEach((z, i) => {
    const [r, g, b] = pal[z]!;
    out.set([r, g, b, 255], i * 4);
  });
  return out;
}

// ---- Minimal dependency-free PNG encoder (RGBA8, stored deflate) ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const u32 = (n: number) => new Uint8Array([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const cat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) (out.set(p, o), (o += p.length));
  return out;
};
function chunk(type: string, data: Uint8Array) {
  const td = cat([new TextEncoder().encode(type), data]);
  return cat([u32(data.length), td, u32(crc32(td))]);
}
function zlibStored(raw: Uint8Array) {
  const parts: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  for (let o = 0; o < raw.length || o === 0; o += 65535) {
    const len = Math.min(65535, raw.length - o);
    const last = o + len >= raw.length ? 1 : 0;
    parts.push(new Uint8Array([last, len & 255, len >>> 8, ~len & 255, (~len >>> 8) & 255]), raw.subarray(o, o + len));
    if (last) break;
  }
  let a = 1;
  let b = 0;
  for (const x of raw) ((a = (a + x) % 65521), (b = (b + a) % 65521));
  parts.push(u32(((b << 16) | a) >>> 0));
  return cat(parts);
}
export function encodePngRgba(width: number, height: number, rgba: Uint8Array): Uint8Array {
  if (rgba.length !== width * height * 4) throw new Error("Panjang buffer tidak cocok dengan dimensi");
  const raw = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const ihdr = cat([u32(width), u32(height), new Uint8Array([8, 6, 0, 0, 0])]);
  return cat([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibStored(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
}

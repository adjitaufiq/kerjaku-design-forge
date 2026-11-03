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

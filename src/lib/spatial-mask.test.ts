import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { spatialBlueprintSchema, spatialHash, type SpatialBlueprint } from "./spatial-blueprint";
import { buildSpatialGeometry, type GeometryInput, type SpatialGeometry } from "./spatial-geometry";
import { buildZoneMap, encodePngRgba, isEditable, ZONE, zoneMapToRgba } from "./spatial-mask";

// Synthetic fixture (not a real project): 5 cells in one lower run, 3000 × 720 mm.
const leaf = (id: string, hingeSide: "left" | "right" | "unknown") => ({ leafId: id, panel: "solid", mechanism: { kind: "swing", hingeSide } });
export const maskBlueprint: SpatialBlueprint = spatialBlueprintSchema.parse({
  version: 2, shape: "straight", corners: [], render: { openAngleDeg: 60 },
  runs: [{ runId: "R", position: "main", level: "lower", columns: [
    { columnId: "C1", columnIndex: 1, cells: [{ cellId: "A", tierIndex: 1, compartment: {}, front: { kind: "leaves", leaves: [leaf("D1", "left")] } }] },
    { columnId: "C2", columnIndex: 2, cells: [{ cellId: "B", tierIndex: 1, compartment: {}, front: { kind: "leaves", leaves: [{ ...leaf("D2", "left"), pairId: "P1" }, { ...leaf("D3", "right"), pairId: "P1" }] } }] },
    { columnId: "C3", columnIndex: 3, cells: [{ cellId: "C", tierIndex: 1, compartment: {}, front: { kind: "drawers", drawers: [{ drawerId: "DR1" }, { drawerId: "DR2" }] } }] },
    { columnId: "C4", columnIndex: 4, cells: [{ cellId: "D", tierIndex: 1, compartment: {}, front: { kind: "leaves", leaves: [leaf("D4", "unknown")] } }] },
    { columnId: "C5", columnIndex: 5, cells: [{ cellId: "E", tierIndex: 1, compartment: {}, front: { kind: "open_niche" } }] },
  ] }],
});
const xs = [0, 600, 1500, 2100, 2600];
const ws = [580, 880, 580, 480, 400];
export const maskInput: GeometryInput = {
  blueprintHash: spatialHash(maskBlueprint),
  frames: [{
    ownerId: "R", widthMm: 3000, heightMm: 720, source: "measured", verifiedBy: "fixture", camera: { kind: "orthographic_front" },
    cells: ["A", "B", "C", "D", "E"].map((id, i) => ({
      cellId: id, rect: { x: xs[i]!, y: 0, w: ws[i]!, h: 720 }, gapMm: 10,
      ...(id === "B" ? { pairSplitMm: 1040 } : {}),
    })),
  }],
};
const W = 600; // 0.2 px/mm
const H = 144;
const geo = (): SpatialGeometry => {
  const r = buildSpatialGeometry(maskBlueprint, maskInput);
  if (!r.valid) throw new Error(r.errors.join());
  return r.geometry;
};
const frame = maskInput.frames[0]! as Parameters<typeof buildZoneMap>[1];
const px = (mmX: number, mmY: number) => Math.floor(mmY * 0.2) * W + Math.floor(mmX * 0.2);

function decodePng(png: Uint8Array) {
  const dv = new DataView(png.buffer, png.byteOffset);
  const w = dv.getUint32(16);
  const h = dv.getUint32(20);
  let o = 8;
  let idat = new Uint8Array();
  while (o < png.length) {
    const len = dv.getUint32(o);
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    if (type === "IDAT") idat = png.slice(o + 8, o + 8 + len);
    o += 12 + len;
  }
  const raw = inflateSync(idat);
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) rgba.set(raw.subarray(y * (w * 4 + 1) + 1, (y + 1) * (w * 4 + 1)), y * w * 4);
  return { w, h, rgba };
}

describe("masking semantics (Tahap 2, terisolasi)", () => {
  const map = buildZoneMap(geo(), frame, W, H);

  it("M1. Dimensi mask = dimensi gambar; PNG valid dapat di-decode", () => {
    for (const sem of ["transparent_is_edit", "white_is_edit"] as const) {
      const d = decodePng(encodePngRgba(W, H, zoneMapToRgba(map, sem)));
      expect([d.w, d.h]).toEqual([W, H]);
      expect(d.rgba.length).toBe(W * H * 4);
    }
    expect(() => encodePngRgba(W + 1, H, zoneMapToRgba(map, "white_is_edit"))).toThrow();
  });

  it("M2. Alpha biner 0/255 sesuai semantik endpoint", () => {
    const t = decodePng(encodePngRgba(W, H, zoneMapToRgba(map, "transparent_is_edit"))).rgba;
    const w = decodePng(encodePngRgba(W, H, zoneMapToRgba(map, "white_is_edit"))).rgba;
    for (let i = 0; i < W * H; i++) {
      const edit = isEditable(map.zones[i]!);
      expect(t[i * 4 + 3]).toBe(edit ? 0 : 255);
      expect(w[i * 4 + 3]).toBe(255);
      expect(w[i * 4]).toBe(edit ? 255 : 0);
    }
  });

  it("M3. Carcass (sekat & celah antar sel) tidak pernah masuk edit mask", () => {
    for (const x of [590, 595, 1490, 2090]) for (const y of [10, 360, 700]) expect(map.zones[px(x, y)]).toBe(ZONE.carcass);
    // Gap band (10 mm = 2 px) at the cell edge stays carcass.
    expect(map.zones[px(601, 360)]).toBe(ZONE.carcass);
    expect(map.conflicts).toBe(0);
  });

  it("M4. Open polygon pintu terverifikasi masuk zona koridor (editable)", () => {
    const g = geo();
    for (const l of g.leaves.filter((l) => l.openPolygon)) {
      const q = l.openPolygon!;
      const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
      const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
      expect(map.zones[Math.floor(cy * H) * W + Math.floor(cx * W)]).toBe(ZONE.corridor);
    }
    // Behind a 60° left-hinged leaf (right half of A's opening) is cavity, still editable.
    expect(map.zones[px(500, 360)]).toBe(ZONE.cavity);
  });

  it("M5. Engsel belum diverifikasi & ceruk terbuka → seluruh sel terlindungi", () => {
    expect(map.protectedCells.sort()).toEqual(["D", "E"]);
    for (let x = 2100; x < 3000; x += 5) expect(isEditable(map.zones[px(x, 360)]!)).toBe(false);
  });

  it("M6. Tidak ada kebocoran: setiap piksel edit berada di dalam bukaan sel terverifikasi", () => {
    const g = geo();
    const openings = g.leaves.filter((l) => l.openPolygon).map((l) => l.closedBounds).concat(g.drawers.map((d) => d.closedBounds));
    for (let i = 0; i < W * H; i++) {
      if (!isEditable(map.zones[i]!)) continue;
      const p = { x: ((i % W) + 0.5) / W, y: (Math.floor(i / W) + 0.5) / H };
      expect(openings.some((r) => p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height)).toBe(true);
    }
  });

  it("M7. Tidak ada celah tak disengaja: bukaan terverifikasi terisi penuh (tanpa lubang)", () => {
    for (const [x0, x1] of [[600 + 10, 1480 - 10], [0 + 10, 580 - 10], [1500 + 10, 2080 - 10]] as const)
      for (let x = x0 + 5; x < x1 - 5; x += 5) for (let y = 15; y < 705; y += 5) expect(isEditable(map.zones[px(x, y)]!)).toBe(true);
  });

  it("M8. Transisi tepi: inset N px membuat pita terlindung tepat N px di sekitar bukaan", () => {
    const m2 = buildZoneMap(geo(), frame, W, H, { edgeInsetPx: 3 });
    // Leftmost editable column of cell A: 10 mm gap = 2 px, + 3 px inset → first editable at x=5.
    const row = Math.floor(H / 2) * W;
    const first = (zs: Uint8Array) => { for (let x = 0; x < W; x++) if (isEditable(zs[row + x]!)) return x; return -1; };
    expect(first(map.zones)).toBe(2);
    expect(first(m2.zones)).toBe(5);
    let a = 0, b = 0;
    for (let i = 0; i < W * H; i++) (a += +isEditable(map.zones[i]!), b += +isEditable(m2.zones[i]!));
    expect(b).toBeLessThan(a);
  });

  it("M9. Kamera perspektif belum didukung di Tahap 2 (tidak diam-diam salah)", () => {
    expect(() => buildZoneMap(geo(), { ...frame, camera: { kind: "pinhole", matrix: [[1,0,0,0],[0,1,0,0],[0,0,1,1]], imageWidth: 1, imageHeight: 1 } }, W, H)).toThrow(/orthographic/);
  });
});

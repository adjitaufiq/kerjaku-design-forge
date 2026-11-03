import type { Box, CompiledCabinet, Component, ParametricCabinetSpec } from "./types";

export class ParametricError extends Error {}

const r = (n: number) => Math.round(n * 100) / 100;

export function validateSpec(s: ParametricCabinetSpec): void {
  const c = s.construction;
  const pos = (v: number, n: string) => {
    if (!Number.isFinite(v) || v <= 0) throw new ParametricError(`${n} harus > 0`);
  };
  pos(s.width, "width");
  pos(s.height, "height");
  pos(s.depth, "depth");
  pos(c.panelThickness, "panelThickness");
  pos(c.backThickness, "backThickness");
  if (!Number.isInteger(s.columns) || s.columns < 1) throw new ParametricError("columns minimal 1");
  if (s.shelfHeights.length !== s.columns) throw new ParametricError("shelfHeights harus per kolom");
  const t = c.panelThickness;
  s.shelfHeights.forEach((col, i) =>
    col.forEach((h) => {
      if (h - t <= t || h >= s.height - t) throw new ParametricError(`ambalan kolom ${i + 1} di luar ruang dalam`);
    }),
  );
  const seen = new Set<number>();
  for (const d of s.doors) {
    if (d.columnIndex < 0 || d.columnIndex >= s.columns) throw new ParametricError("pintu di kolom tak ada");
    if (seen.has(d.columnIndex)) throw new ParametricError("satu kolom hanya satu daun pada prototype");
    seen.add(d.columnIndex);
  }
  if (c.hingesPerLeaf < 2) throw new ParametricError("minimal 2 engsel per daun");
  if (s.width - (s.columns + 1) * t <= 0) throw new ParametricError("lebar tidak cukup untuk panel");
}

function cut(box: Box, thicknessAxis: "w" | "h" | "d") {
  const dims = { w: box.w, h: box.h, d: box.d };
  const thickness = dims[thicknessAxis];
  const others = (["w", "h", "d"] as const).filter((k) => k !== thicknessAxis).map((k) => dims[k]);
  return { length: r(Math.max(...others)), width: r(Math.min(...others)), thickness: r(thickness) };
}

export function compileCabinet(spec: ParametricCabinetSpec): CompiledCabinet {
  validateSpec(spec);
  const { width: W, height: H, depth: D, construction: c } = spec;
  const t = c.panelThickness;
  const bt = c.backThickness;
  const st = spec.dimensionStatus;
  const id = spec.id;
  const out: Component[] = [];
  const add = (cmp: Omit<Component, "cut" | "dimensionStatus">, axis: "w" | "h" | "d") =>
    out.push({ ...cmp, cut: cut(cmp.box, axis), dimensionStatus: st });

  add({ id: `${id}-SIDE-L`, role: "side", parentCell: null, column: null, box: { x: 0, y: 0, z: 0, w: t, h: H, d: D }, material: spec.material.body }, "w");
  add({ id: `${id}-SIDE-R`, role: "side", parentCell: null, column: null, box: { x: W - t, y: 0, z: 0, w: t, h: H, d: D }, material: spec.material.body }, "w");
  add({ id: `${id}-BOTTOM`, role: "bottom", parentCell: null, column: null, box: { x: t, y: 0, z: 0, w: W - 2 * t, h: t, d: D }, material: spec.material.body }, "h");
  add({ id: `${id}-TOP`, role: "top", parentCell: null, column: null, box: { x: t, y: H - t, z: 0, w: W - 2 * t, h: t, d: D }, material: spec.material.body }, "h");
  add({ id: `${id}-BACK`, role: "back", parentCell: null, column: null, box: { x: t, y: t, z: 0, w: W - 2 * t, h: H - 2 * t, d: bt }, material: spec.material.body }, "d");

  const n = spec.columns;
  const innerW = (W - (n + 1) * t) / n;
  const cells: CompiledCabinet["cells"] = [];
  for (let i = 0; i < n; i++) {
    const x0 = t + i * (innerW + t);
    if (i > 0)
      add({ id: `${id}-DIV-${i}`, role: "divider", parentCell: null, column: null, box: { x: x0 - t, y: t, z: bt, w: t, h: H - 2 * t, d: D - bt }, material: spec.material.body }, "w");
    const cellId = `${id}-C${i + 1}`;
    cells.push({ id: cellId, column: i + 1, box: { x: x0, y: t, z: bt, w: innerW, h: H - 2 * t, d: D - bt } });
    (spec.shelfHeights[i] ?? []).forEach((hTop, k) =>
      add({ id: `${id}-C${i + 1}-SHELF-${k + 1}`, role: "shelf", parentCell: cellId, column: i + 1, box: { x: x0, y: hTop - t, z: bt, w: innerW, h: t, d: D - bt - c.shelfFrontSetback }, material: spec.material.body }, "h"),
    );
  }

  const g = c.doorGap;
  const leafW = (W - (n + 1) * g) / n;
  const leafH = H - 2 * g;
  const y1 = c.hingeOffsetFromEdge;
  const y2 = leafH - c.hingeOffsetFromEdge;
  const ys = Array.from({ length: c.hingesPerLeaf }, (_, k) => r(g + y1 + ((y2 - y1) * k) / (c.hingesPerLeaf - 1)));
  for (const d of [...spec.doors].sort((a, b) => a.columnIndex - b.columnIndex)) {
    const i = d.columnIndex;
    add({
      id: `${id}-C${i + 1}-D1`,
      role: "door",
      parentCell: `${id}-C${i + 1}`,
      column: i + 1,
      box: { x: r(g + i * (leafW + g)), y: g, z: D, w: r(leafW), h: leafH, d: t },
      material: spec.material.door,
      hingeSide: d.hingeSide,
      hardware: [{ ref: spec.hingeRef, kind: "hinge", positionsY: ys }],
    }, "d");
  }

  const ids = new Set(out.map((o) => o.id));
  if (ids.size !== out.length) throw new ParametricError("ID komponen ganda");
  return { spec, components: out, cells, productionReady: st === "verified" };
}

/** Hinge tally: 1 set = 2 pcs. Displays set first. */
export function hingeTally(cab: CompiledCabinet) {
  const pcs = cab.components.reduce((s, c) => s + (c.hardware?.reduce((a, h) => a + h.positionsY.length, 0) ?? 0), 0);
  const sets = Math.ceil(pcs / 2);
  return { sets, pcs, label: `${sets} set (${pcs} pcs)` };
}

export function cuttingList(cab: CompiledCabinet) {
  return cab.components.map((c) => ({
    id: c.id,
    role: c.role,
    material: c.material,
    length: c.cut.length,
    width: c.cut.width,
    thickness: c.cut.thickness,
    qty: 1,
    status: c.dimensionStatus,
  }));
}

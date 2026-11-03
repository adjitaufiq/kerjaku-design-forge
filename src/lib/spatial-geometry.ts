import { z } from "zod";
import { spatialHash, type Cell, type SpatialBlueprint } from "./spatial-blueprint";

/**
 * Geometry Engine (Phase 2, Tahap 1). Pure math, no AI.
 *
 * - Coordinates are run-local millimetres from a VERIFIED source (workshop measurement or
 *   designer-confirmed photo annotation). Nothing is invented: a cell without a supplied rect
 *   is an error, and a pair without a measured meeting line is an error.
 * - Open-leaf projection uses an explicit camera: `orthographic_front` (elevation drawing) or
 *   `pinhole` (calibrated 3x4 matrix for a photo). cos(angle) is only the orthographic case.
 * - Polygons are reference geometry for rendering and QC; they do not force a diffusion model.
 *
 * 3D frame per run/corner: x → right along the run, y → down from the frame top, z → toward viewer.
 */

const mm = z.number().finite().min(0).max(20000);
export const rectMmSchema = z
  .object({ x: mm, y: mm, w: mm.positive(), h: mm.positive() })
  .strict();
export type RectMm = z.infer<typeof rectMmSchema>;

export const cameraSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("orthographic_front") }).strict(),
  z
    .object({
      kind: z.literal("pinhole"),
      /** 3x4 projection: [u v w]^T = P · [x y z 1]^T, pixel = (u/w, v/w). */
      matrix: z.array(z.array(z.number().finite()).length(4)).length(3),
      imageWidth: z.number().int().positive(),
      imageHeight: z.number().int().positive(),
    })
    .strict(),
]);
export type Camera = z.infer<typeof cameraSchema>;

export const frameSchema = z
  .object({
    /** runId or cornerId from the blueprint. */
    ownerId: z.string().min(1),
    widthMm: mm.positive(),
    heightMm: mm.positive(),
    source: z.enum(["measured", "photo_annotation"]),
    verifiedBy: z.string().trim().min(1),
    camera: cameraSchema,
    cells: z
      .array(
        z
          .object({
            cellId: z.string().min(1),
            rect: rectMmSchema,
            /** Required for a 2-leaf pair: x (mm, run-local) of the measured meeting gap. */
            pairSplitMm: mm.optional(),
            /** Physical gap kept between leaf edge and opening edge. */
            gapMm: z.number().min(0).max(10).default(0),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type GeometryFrame = z.infer<typeof frameSchema>;

export const geometryInputSchema = z
  .object({ blueprintHash: z.string().min(1), frames: z.array(frameSchema).min(1) })
  .strict();
export type GeometryInput = z.input<typeof geometryInputSchema>;

export type Point2D = { x: number; y: number };
export type NormalizedRect = { x: number; y: number; width: number; height: number };
export type Quad = [Point2D, Point2D, Point2D, Point2D];

export type LeafPhysicalGeometry = {
  leafId: string;
  parentCellId: string;
  ownerId: string;
  kind: "swing" | "lift_up";
  closedRectMm: RectMm;
  /** Normalized 0..1 in the frame's image space (ortho: frame; pinhole: image). */
  closedBounds: NormalizedRect;
  hingeEdge: "left" | "right" | "top" | null;
  swingDirection: "outward_left" | "outward_right" | "upward" | null;
  openingAngleDeg: number;
  /** Midpoint of the hinge edge, normalized. null when hinge side is unverified. */
  hingeAnchor: Point2D | null;
  /** [hingeStart, freeStart, freeEnd, hingeEnd]; null when hinge side is unverified. */
  openPolygon: Quad | null;
};
export type DrawerGeometry = { drawerId: string; parentCellId: string; ownerId: string; closedBounds: NormalizedRect };
export type CellGeometry = { cellId: string; ownerId: string; rectMm: RectMm; bounds: NormalizedRect };

export type SpatialGeometry = {
  blueprintHash: string;
  cells: CellGeometry[];
  leaves: LeafPhysicalGeometry[];
  drawers: DrawerGeometry[];
  /** Non-blocking: geometry that cannot be drawn until verified (e.g. hinge side unknown). */
  pending: string[];
};

type Vec3 = [number, number, number];
const EPS = 0.5; // mm tolerance

const inside = (a: RectMm, b: RectMm) =>
  a.x >= b.x - EPS && a.y >= b.y - EPS && a.x + a.w <= b.x + b.w + EPS && a.y + a.h <= b.y + b.h + EPS;
const overlaps = (a: RectMm, b: RectMm) =>
  a.x + EPS < b.x + b.w && b.x + EPS < a.x + a.w && a.y + EPS < b.y + b.h && b.y + EPS < a.y + a.h;

function project(cam: Camera, f: GeometryFrame, p: Vec3): Point2D {
  if (cam.kind === "orthographic_front") return { x: p[0] / f.widthMm, y: p[1] / f.heightMm };
  const m = cam.matrix;
  const r = (i: number) => m[i]![0]! * p[0] + m[i]![1]! * p[1] + m[i]![2]! * p[2] + m[i]![3]!;
  const w = r(2);
  if (!(w > 0)) throw new Error("Titik di belakang kamera — kalibrasi kamera tidak valid");
  return { x: r(0) / w / cam.imageWidth, y: r(1) / w / cam.imageHeight };
}

function boundsOf(cam: Camera, f: GeometryFrame, r: RectMm): NormalizedRect {
  const pts = [
    [r.x, r.y, 0],
    [r.x + r.w, r.y, 0],
    [r.x + r.w, r.y + r.h, 0],
    [r.x, r.y + r.h, 0],
  ].map((p) => project(cam, f, p as Vec3));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** 3D corners of an opened leaf, hinge edge first. Exported for plan-view checks/tests. */
export function openLeaf3D(r: RectMm, edge: "left" | "right" | "top", deg: number): [Vec3, Vec3, Vec3, Vec3] {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  if (edge === "left")
    return [[r.x, r.y, 0], [r.x + r.w * c, r.y, r.w * s], [r.x + r.w * c, r.y + r.h, r.w * s], [r.x, r.y + r.h, 0]];
  if (edge === "right")
    return [[r.x + r.w, r.y, 0], [r.x + r.w - r.w * c, r.y, r.w * s], [r.x + r.w - r.w * c, r.y + r.h, r.w * s], [r.x + r.w, r.y + r.h, 0]];
  // Lift-up: hinge on top edge, free (bottom) edge rises toward the viewer.
  return [[r.x, r.y, 0], [r.x, r.y + r.h * c, r.h * s], [r.x + r.w, r.y + r.h * c, r.h * s], [r.x + r.w, r.y, 0]];
}

/** Plan-view (x,z) segment intersection: two swing leaves physically striking each other. */
function segmentsCross(a: [number, number][], b: [number, number][]) {
  const o = (p: [number, number], q: [number, number], r: [number, number]) =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const [p1, p2] = a as [[number, number], [number, number]];
  const [p3, p4] = b as [[number, number], [number, number]];
  return o(p1, p2, p3) * o(p1, p2, p4) < 0 && o(p3, p4, p1) * o(p3, p4, p2) < 0;
}

function ownersOf(bp: SpatialBlueprint) {
  const m = new Map<string, Cell[]>();
  for (const r of bp.runs) m.set(r.runId, r.columns.flatMap((c) => c.cells));
  for (const k of bp.corners) m.set(k.cornerId, k.cells);
  return m;
}

export function buildSpatialGeometry(
  bp: SpatialBlueprint,
  raw: GeometryInput,
): { valid: true; geometry: SpatialGeometry } | { valid: false; errors: string[] } {
  const parsed = geometryInputSchema.safeParse(raw);
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const input = parsed.data;
  const errors: string[] = [];
  const pending: string[] = [];
  const hash = spatialHash(bp);
  if (input.blueprintHash !== hash) errors.push("Geometri dibuat untuk blueprint lain (hash tidak cocok)");

  const owners = ownersOf(bp);
  const frames = new Map<string, GeometryFrame>();
  for (const f of input.frames) {
    if (!owners.has(f.ownerId)) errors.push(`Frame ${f.ownerId} tidak ada di blueprint`);
    if (frames.has(f.ownerId)) errors.push(`Frame ganda: ${f.ownerId}`);
    frames.set(f.ownerId, f);
  }
  const cells: CellGeometry[] = [];
  const leaves: LeafPhysicalGeometry[] = [];
  const drawers: DrawerGeometry[] = [];
  const angleDefault = bp.render.openAngleDeg;

  for (const [ownerId, ownerCells] of owners) {
    const f = frames.get(ownerId);
    if (!f) {
      errors.push(`Ukuran/anotasi ${ownerId} belum diverifikasi`);
      continue;
    }
    const frameRect: RectMm = { x: 0, y: 0, w: f.widthMm, h: f.heightMm };
    const byId = new Map(f.cells.map((c) => [c.cellId, c]));
    for (const c of f.cells)
      if (!ownerCells.some((x) => x.cellId === c.cellId)) errors.push(`Sel ${c.cellId} bukan milik ${ownerId}`);
    const placed: { id: string; r: RectMm }[] = [];
    const plan: { id: string; seg: [number, number][]; y: [number, number] }[] = [];
    for (const cell of ownerCells) {
      const g = byId.get(cell.cellId);
      if (!g) {
        errors.push(`Sel ${cell.cellId} belum punya koordinat terverifikasi`);
        continue;
      }
      if (!inside(g.rect, frameRect)) errors.push(`Sel ${cell.cellId} keluar dari batas ${ownerId}`);
      for (const p of placed) if (overlaps(p.r, g.rect)) errors.push(`Sel ${cell.cellId} bertumpuk dengan ${p.id}`);
      placed.push({ id: cell.cellId, r: g.rect });
      cells.push({ cellId: cell.cellId, ownerId, rectMm: g.rect, bounds: boundsOf(f.camera, f, g.rect) });

      const gap = g.gapMm;
      const opening: RectMm = { x: g.rect.x + gap, y: g.rect.y + gap, w: g.rect.w - 2 * gap, h: g.rect.h - 2 * gap };
      if (cell.front.kind === "drawers") {
        // Drawer heights are not inferred: only the stack region is known until measured.
        for (const d of cell.front.drawers)
          drawers.push({ drawerId: d.drawerId, parentCellId: cell.cellId, ownerId, closedBounds: boundsOf(f.camera, f, opening) });
        continue;
      }
      if (cell.front.kind !== "leaves") {
        if (g.pairSplitMm !== undefined) errors.push(`Sel ${cell.cellId} tanpa pintu tidak boleh punya garis pasangan`);
        continue;
      }
      const ls = cell.front.leaves;
      let rects: RectMm[];
      if (ls.length === 2) {
        const s = g.pairSplitMm;
        if (s === undefined) {
          errors.push(`Pasangan di ${cell.cellId} butuh garis temu terukur (pairSplitMm)`);
          continue;
        }
        if (s <= opening.x + EPS || s >= opening.x + opening.w - EPS) {
          errors.push(`Garis temu ${cell.cellId} di luar bukaan`);
          continue;
        }
        rects = [
          { ...opening, w: s - opening.x },
          { ...opening, x: s, w: opening.x + opening.w - s },
        ];
        // The leaf hinged left must sit on the left half.
        const leftIdx = ls.findIndex((l) => l.mechanism.kind === "swing" && l.mechanism.hingeSide === "left");
        if (leftIdx === 1) rects.reverse();
      } else {
        if (g.pairSplitMm !== undefined) errors.push(`Sel ${cell.cellId} satu daun tidak boleh punya garis pasangan`);
        rects = [opening];
      }
      ls.forEach((l, i) => {
        const r = rects[i]!;
        if (!inside(r, g.rect)) errors.push(`Daun ${l.leafId} keluar dari sel induk ${cell.cellId}`);
        const angle = l.openAngleDeg ?? angleDefault;
        const edge =
          l.mechanism.kind === "lift_up"
            ? l.mechanism.hingeAxis === "top"
              ? "top"
              : null
            : l.mechanism.hingeSide === "unknown"
              ? null
              : l.mechanism.hingeSide;
        if (!edge) pending.push(`Sisi engsel ${l.leafId} belum diverifikasi — bukaan tidak digambar`);
        const q = edge ? openLeaf3D(r, edge, angle) : null;
        const poly = q ? (q.map((p) => project(f.camera, f, p)) as Quad) : null;
        if (q && edge !== "top")
          plan.push({ id: l.leafId, seg: [[q[0][0], q[0][2]], [q[1][0], q[1][2]]], y: [r.y, r.y + r.h] });
        leaves.push({
          leafId: l.leafId,
          parentCellId: cell.cellId,
          ownerId,
          kind: l.mechanism.kind,
          closedRectMm: r,
          closedBounds: boundsOf(f.camera, f, r),
          hingeEdge: edge,
          swingDirection: edge === "left" ? "outward_left" : edge === "right" ? "outward_right" : edge === "top" ? "upward" : null,
          openingAngleDeg: angle,
          hingeAnchor: poly ? { x: (poly[0].x + poly[3].x) / 2, y: (poly[0].y + poly[3].y) / 2 } : null,
          openPolygon: poly,
        });
      });
    }
    for (let i = 0; i < plan.length; i++)
      for (let j = i + 1; j < plan.length; j++) {
        const a = plan[i]!;
        const b = plan[j]!;
        const sameHeight = a.y[0] < b.y[1] - EPS && b.y[0] < a.y[1] - EPS;
        if (sameHeight && segmentsCross(a.seg, b.seg)) errors.push(`Daun ${a.id} dan ${b.id} bertabrakan saat dibuka`);
      }
  }
  // Every physical leaf has exactly one geometry.
  const counts = new Map<string, number>();
  leaves.forEach((l) => counts.set(l.leafId, (counts.get(l.leafId) ?? 0) + 1));
  for (const [id, n] of counts) if (n !== 1) errors.push(`Daun ${id} punya ${n} geometri`);

  return errors.length
    ? { valid: false, errors: [...new Set(errors)] }
    : { valid: true, geometry: { blueprintHash: hash, cells, leaves, drawers, pending } };
}

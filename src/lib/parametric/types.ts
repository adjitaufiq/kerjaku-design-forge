// KERJAKU Interior Studio — Parametric Core types (Milestone A).
// Isolated module: not imported by any production generator.

export type DimensionStatus = "verified" | "provisional";

/** Explicit construction rules. Every number is declared, never inferred. */
export interface CabinetConstruction {
  panelThickness: number; // mm, carcass & shelves & doors
  backThickness: number; // mm, back panel
  /** Back panel sits inside the carcass, flush with the rear edge. */
  backInset: "inside-flush";
  doorGap: number; // mm, gap around/between overlay doors
  shelfFrontSetback: number; // mm, shelf front edge behind carcass front
  hingeOffsetFromEdge: number; // mm, hinge centre from door top/bottom edge
  hingesPerLeaf: number;
}

export interface ParametricCabinetSpec {
  id: string; // e.g. CAB-01
  name: string;
  width: number;
  height: number;
  depth: number;
  dimensionStatus: DimensionStatus;
  columns: number;
  /** Shelf top surface height measured from carcass bottom outer face, per column. */
  shelfHeights: number[][];
  /** One swing leaf per column; hinge side explicit. */
  doors: { columnIndex: number; hingeSide: "left" | "right" }[];
  construction: CabinetConstruction;
  material: { body: string; door: string; finish: string };
  hingeRef: string;
}

export type PanelRole = "side" | "top" | "bottom" | "divider" | "shelf" | "back" | "door";

/** Axis-aligned box in mm. x: left→right, y: bottom→top, z: back(0)→front. */
export interface Box {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

export interface Component {
  id: string;
  role: PanelRole;
  parentCell: string | null;
  column: number | null;
  box: Box;
  /** Cut size: length × width × thickness (mm). */
  cut: { length: number; width: number; thickness: number };
  material: string;
  dimensionStatus: DimensionStatus;
  hingeSide?: "left" | "right";
  hardware?: { ref: string; kind: "hinge"; positionsY: number[] }[];
}

export interface CompiledCabinet {
  spec: ParametricCabinetSpec;
  components: Component[];
  cells: { id: string; column: number; box: Box }[];
  productionReady: boolean;
}

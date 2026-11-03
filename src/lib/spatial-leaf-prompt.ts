/**
 * Leaf opening prompt compiler: hinge side, swing direction, hinge anchor and handle side are
 * read ONLY from LeafPhysicalGeometry — never written by hand — so prompt and geometry cannot
 * contradict each other. Isolated experiment helper; not wired to the production generator.
 */
import type { LeafPhysicalGeometry, Point2D } from "./spatial-geometry";
import { freeEdgeHandleRegion, handleOnFreeSide } from "./spatial-mask";

export type HandleSide = "left" | "right" | "bottom";

export type LeafPromptFacts = {
  leafId: string;
  hingeEdge: "left" | "right" | "top";
  swingDirection: "outward_left" | "outward_right" | "upward";
  hingeAnchorPx: Point2D;
  handlePosition: HandleSide;
  hingeCount: number;
};

export class LeafPromptError extends Error {}

const OPPOSITE: Record<"left" | "right" | "top", HandleSide> = { left: "right", right: "left", top: "bottom" };

/** Derive prompt facts from geometry. Throws when the hinge is unverified or geometry is inconsistent. */
export function leafPromptFacts(leaf: LeafPhysicalGeometry, imageW: number, imageH: number, hingeCount = 2): LeafPromptFacts {
  if (!leaf.hingeEdge || !leaf.swingDirection || !leaf.hingeAnchor || !leaf.openPolygon)
    throw new LeafPromptError(`Daun ${leaf.leafId}: sisi engsel belum diverifikasi — prompt tidak dibuat`);
  const expectedSwing = leaf.hingeEdge === "left" ? "outward_left" : leaf.hingeEdge === "right" ? "outward_right" : "upward";
  if (leaf.swingDirection !== expectedSwing)
    throw new LeafPromptError(`Daun ${leaf.leafId}: arah buka ${leaf.swingDirection} bertentangan dengan engsel ${leaf.hingeEdge}`);
  const handlePosition = OPPOSITE[leaf.hingeEdge];
  if (leaf.hingeEdge !== "top") {
    const q = leaf.openPolygon;
    if (!handleOnFreeSide(q, freeEdgeHandleRegion(q, 0.002)))
      throw new LeafPromptError(`Daun ${leaf.leafId}: handle tidak berada di sisi bebas polygon`);
    const hx = (q[0].x + q[3].x) / 2, fx = (q[1].x + q[2].x) / 2;
    const freeSide = fx > hx ? "right" : "left";
    if (freeSide !== handlePosition)
      throw new LeafPromptError(`Daun ${leaf.leafId}: sisi bebas polygon (${freeSide}) ≠ handle (${handlePosition})`);
  }
  return {
    leafId: leaf.leafId,
    hingeEdge: leaf.hingeEdge,
    swingDirection: leaf.swingDirection,
    hingeAnchorPx: { x: Math.round(leaf.hingeAnchor.x * imageW), y: Math.round(leaf.hingeAnchor.y * imageH) },
    handlePosition,
    hingeCount,
  };
}

/** Compile the single-leaf opening prompt. All directional words come from `facts`. */
export function compileLeafOpeningPrompt(f: LeafPromptFacts): string {
  const open =
    f.swingDirection === "upward"
      ? "lifted upward, hinged along its top edge"
      : `swung open toward the viewer, hinged on its ${f.hingeEdge} vertical edge (viewer's ${f.hingeEdge}) at about x=${f.hingeAnchorPx.x}px, y=${f.hingeAnchorPx.y}px`;
  return [
    `Inside the marked area only, show exactly ONE door leaf (${f.leafId}) ${open}.`,
    "The leaf is complete and uncut from its top edge to its bottom edge, showing its board thickness edge.",
    `Show exactly ${f.hingeCount} concealed cup hinges on the ${f.hingeEdge} hinge edge.`,
    `Mount exactly one handle on the ${f.handlePosition} free edge of the open leaf; never on the hinge edge.`,
    "No second leaf, no extra door, drawer or panel anywhere.",
    "Soft contact shadow only; keep wall and cabinet colors unchanged; no rectangular patch edges.",
  ].join(" ");
}

/** Consistency check used by tests and before any Gateway call. Returns the list of violations. */
export function checkPromptMatchesGeometry(prompt: string, f: LeafPromptFacts): string[] {
  const errs: string[] = [];
  const other = f.handlePosition === "left" ? "right" : f.handlePosition === "right" ? "left" : null;
  if (!prompt.includes(`on the ${f.handlePosition} free edge`)) errs.push("sisi handle tidak sesuai geometri");
  if (other && prompt.includes(`on the ${other} free edge`)) errs.push("prompt menyebut sisi bebas yang salah");
  if (!prompt.includes(`${f.hingeCount} concealed cup hinges on the ${f.hingeEdge} hinge edge`)) errs.push("sisi engsel tidak sesuai geometri");
  if ((prompt.match(/exactly ONE door leaf/g) ?? []).length !== 1) errs.push("jumlah daun bukan satu");
  return errs;
}

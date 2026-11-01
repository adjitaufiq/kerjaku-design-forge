// Handoff contract with Smart Material Estimator (SME, Apps #3).
import { toSmeSpec, type SpecHints } from "@/lib/interior-spec";
export const ESTIMATOR_BASE_URL = "https://smart-material-kalk.lovable.app/import";
export const ESTIMATE_ACTIVITY_TITLE = "Estimasi Material (SME)";

export type ShoppingItem = {
  name: string;
  code?: string;
  qty: number;
  unit?: string;
  unitPrice?: number;
  subtotal?: number;
};
export type EstimatePayload = {
  projectId: string;
  materialCost?: number;
  /** Perintilan workshop (paku, sekrup, fischer, pin) dihitung SME, terpisah dari shoppingList. */
  workshopConsumablesCost?: number;
  workshopConsumables?: ShoppingItem[];
  workdays?: number;
  shoppingList?: ShoppingItem[];
  estimateId?: string;
  status?: string;
  estimatedMaterialCost?: number;
  summary?: {
    sheetCount?: Record<string, number>;
    hardwareCount?: Record<string, number>;
    estimatedDays?: number;
    lastCalculatedAt?: string;
  };
  deepLinkUrl?: string;
};

const JOB_TYPE: Record<string, string> = {
  KITCHEN_SET: "kitchen_set",
  WARDROBE: "wardrobe",
  BEDROOM_INTERIOR: "bedroom",
  LIVING_ROOM: "living_room",
  OFFICE_INTERIOR: "office",
};

export function toJobType(projectType: string): string {
  return JOB_TYPE[projectType.toUpperCase()] ?? "custom";
}

export function buildEstimatorUrl(input: {
  projectId: string;
  workspaceId: string;
  leadId: string;
  clientName: string;
  phone?: string | null;
  location?: string | null;
  projectName: string;
  projectType: string;
  notes?: string | null;
  beforeUrl?: string | null;
  renderUrl?: string | null;
  interiorUrl?: string | null;
  specHints?: SpecHints | null | undefined;
  origin: string;
}): string {
  const p = new URLSearchParams();
  const set = (k: string, v?: string | null) => {
    if (v) p.set(k, v);
  };
  set("projectId", input.projectId);
  set("workspaceId", input.workspaceId);
  set("clientName", input.clientName);
  set("phone", input.phone);
  set("location", input.location);
  set("projectName", input.projectName);
  set("jobType", toJobType(input.projectType));
  set("notes", input.notes);
  set("beforeUrl", input.beforeUrl);
  set("renderUrl", input.renderUrl);
  set("interiorUrl", input.interiorUrl);
  set("shape", input.specHints?.shape);
  const smeSpec = input.specHints ? toSmeSpec(input.specHints) : undefined;
  if (smeSpec) set("specHints", toBase64Url(smeSpec));
  const returnUrl = `${input.origin}/leads/${input.leadId}`;
  set("returnUrl", returnUrl);
  // Single-param payload requested by SME; individual params stay as fallback.
  const payload: Record<string, unknown> = { leadId: input.leadId, returnUrl };
  for (const [k, v] of p.entries()) if (k !== "specHints") payload[k] = v;
  if (smeSpec) payload.specHints = smeSpec;
  p.set("data", toBase64Url(payload));
  return `${ESTIMATOR_BASE_URL}?${p.toString()}`;
}

function toBase64Url(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode `?estimate=` (JSON or base64/base64url JSON) sent back by SME. */
export function parseEstimateParam(raw: string): EstimatePayload | null {
  const tryJson = (s: string) => {
    try {
      const v = JSON.parse(s) as EstimatePayload;
      return v && typeof v.projectId === "string" ? v : null;
    } catch {
      return null;
    }
  };
  const direct = tryJson(raw);
  if (direct) return direct;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return tryJson(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

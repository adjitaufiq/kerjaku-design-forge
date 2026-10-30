// Handoff contract with Smart Material Estimator (SME, Apps #3).
import type { SpecHints } from "@/lib/interior-spec";
export const ESTIMATOR_BASE_URL = "https://smart-material-kalk.lovable.app/import";
export const ESTIMATE_ACTIVITY_TITLE = "Estimasi Material (SME)";

export type EstimatePayload = {
  projectId: string;
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
  specHints?: SpecHints | null;
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
  if (input.specHints) {
    const bytes = new TextEncoder().encode(JSON.stringify(input.specHints));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    set("specHints", btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  }
  set("returnUrl", `${input.origin}/leads/${input.leadId}`);
  return `${ESTIMATOR_BASE_URL}?${p.toString()}`;
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

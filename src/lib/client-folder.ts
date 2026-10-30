import { data } from "@/services/data";
import type { Lead, ProjectType } from "@/services/domain/models";

/** Normalises a WhatsApp number so 0812…, +62812… and 62812… match. */
export function normalizePhone(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("62")) return "0" + d.slice(2);
  return d;
}

/** Finds an existing lead with the same WhatsApp number. */
export function findLeadByPhone(leads: Lead[], phone: string): Lead | undefined {
  const key = normalizePhone(phone);
  if (!key) return undefined;
  return leads.find((l) => normalizePhone(l.phone) === key);
}

/**
 * One client = one lead. Reuses `existingLeadId`, or a lead with the same
 * WhatsApp number, before creating a new one.
 */
export async function resolveClientLead(
  workspaceId: string,
  input: {
    existingLeadId?: string | null;
    name: string;
    location: string;
    phone: string;
    source: string;
  },
): Promise<string> {
  if (input.existingLeadId) return input.existingLeadId;
  const leads = await data.leads.list(workspaceId);
  const match = findLeadByPhone(leads, input.phone);
  if (match) return match.id;
  const lead = await data.leads.create(workspaceId, {
    clientName: input.name,
    location: input.location,
    phone: input.phone,
    source: input.source,
    status: "CONSULTATION",
  });
  return lead.id;
}

/** One job per client per name: "Kitchen Set" stays a single project. */
export async function resolveClientProject(
  workspaceId: string,
  leadId: string,
  jobName: string,
  projectType: ProjectType,
): Promise<{ id: string; isNew: boolean }> {
  const projects = await data.projects.listByLead(leadId);
  const match = projects.find(
    (p) => p.projectName.trim().toLowerCase() === jobName.trim().toLowerCase(),
  );
  if (match) return { id: match.id, isNew: false };
  const p = await data.projects.create(workspaceId, { leadId, projectName: jobName, projectType });
  return { id: p.id, isNew: true };
}

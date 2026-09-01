/** Sample preview data — development mode only. Never used in production builds. */

import type { Lead, Project } from "@/services/domain/models";

export const isDemoAvailable = import.meta.env.DEV;

function iso(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

const WS = "demo-workspace";

export const demoLeads: Lead[] = [
  {
    id: "demo-lead-1",
    workspaceId: WS,
    clientName: "Bu Rina Wijaya",
    phone: "081234567890",
    email: "rina@example.com",
    location: "Bintaro, Tangsel",
    source: "Instagram",
    status: "NEW",
    nextFollowUp: iso(-1),
    createdAt: iso(-9),
    updatedAt: iso(-1),
  },
  {
    id: "demo-lead-2",
    workspaceId: WS,
    clientName: "Pak Andi Saputra",
    phone: "081298765432",
    email: null,
    location: "Bandung",
    source: "Referral",
    status: "CONSULTATION",
    nextFollowUp: iso(2),
    createdAt: iso(-7),
    updatedAt: iso(-2),
  },
  {
    id: "demo-lead-3",
    workspaceId: WS,
    clientName: "Ibu Maya Kartika",
    phone: "081377712345",
    email: "maya@example.com",
    location: "Surabaya",
    source: "WhatsApp",
    status: "PROPOSAL",
    nextFollowUp: iso(1),
    createdAt: iso(-14),
    updatedAt: iso(-3),
  },
  {
    id: "demo-lead-4",
    workspaceId: WS,
    clientName: "Pak Hendra Gunawan",
    phone: "081555000111",
    email: null,
    location: "Jakarta Selatan",
    source: "Website",
    status: "NEGOTIATION",
    nextFollowUp: iso(4),
    createdAt: iso(-21),
    updatedAt: iso(-4),
  },
  {
    id: "demo-lead-5",
    workspaceId: WS,
    clientName: "Ibu Sarah Lim",
    phone: "081812340000",
    email: null,
    location: "BSD City",
    source: "Instagram",
    status: "DEAL",
    nextFollowUp: null,
    createdAt: iso(-30),
    updatedAt: iso(-6),
  },
  {
    id: "demo-lead-6",
    workspaceId: WS,
    clientName: "Pak Yusuf Rahman",
    phone: "081900011122",
    email: null,
    location: "Depok",
    source: "Referral",
    status: "PRODUCTION",
    nextFollowUp: null,
    createdAt: iso(-45),
    updatedAt: iso(-10),
  },
];

export const demoProjects: Project[] = [
  {
    id: "demo-project-1",
    workspaceId: WS,
    leadId: "demo-lead-2",
    projectName: "Kitchen Set Japandi 4m",
    projectType: "KITCHEN_SET",
    status: "DESIGN",
    estimatedValue: 48_500_000,
    createdAt: iso(-6),
  },
  {
    id: "demo-project-2",
    workspaceId: WS,
    leadId: "demo-lead-3",
    projectName: "Wardrobe Sliding 3 Pintu",
    projectType: "WARDROBE",
    status: "PROPOSAL",
    estimatedValue: 27_000_000,
    createdAt: iso(-12),
  },
  {
    id: "demo-project-3",
    workspaceId: WS,
    leadId: "demo-lead-4",
    projectName: "Interior Kamar Utama",
    projectType: "BEDROOM_INTERIOR",
    status: "PROPOSAL",
    estimatedValue: 96_000_000,
    createdAt: iso(-18),
  },
  {
    id: "demo-project-4",
    workspaceId: WS,
    leadId: "demo-lead-6",
    projectName: "Office Fit-out Lantai 2",
    projectType: "OFFICE_INTERIOR",
    status: "PRODUCTION",
    estimatedValue: 185_000_000,
    createdAt: iso(-40),
  },
];

import { jsPDF } from "jspdf";

import { formatDate, formatIDR, PROJECT_TYPE_LABEL } from "@/services/domain/models";
import type { Project, Proposal, ProposalItem, Workshop } from "@/services/domain/models";

export interface ProposalPdfInput {
  proposal: Proposal;
  items: ProposalItem[];
  project: Project | null;
  clientName: string | null;
  workshop: Workshop | null;
  /** Optional data URL of a project image rendered on the concept page. */
  imageDataUrl?: string | null;
  /** Optional data URL of the workshop logo. */
  logoDataUrl?: string | null;
}

const NAVY = { r: 14, g: 22, b: 40 };
const ORANGE = { r: 233, g: 122, b: 47 };
const GREY = { r: 110, g: 120, b: 138 };

/** Convert a remote image URL into a data URL usable by jsPDF. */
export async function toDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export const PROPOSAL_PAGES = [
  "Cover",
  "Concept",
  "Scope of Work",
  "Material Specification",
  "Bill of Quantity",
  "Terms & Agreement",
] as const;

export function buildProposalPdf(input: ProposalPdfInput): Blob {
  const { proposal, items, project, clientName, workshop, imageDataUrl, logoDataUrl } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;

  const header = (label: string) => {
    doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    doc.rect(0, 0, W, 64, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text((workshop?.name ?? "KERJAKU Interior").toUpperCase(), M, 38);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(230, 230, 235);
    doc.setFontSize(9);
    doc.text(label, W - M, 38, { align: "right" });
    doc.setTextColor(20, 20, 20);
  };

  const footer = (page: number) => {
    doc.setFontSize(8);
    doc.setTextColor(GREY.r, GREY.g, GREY.b);
    doc.text(
      [workshop?.phone, workshop?.email, workshop?.city].filter(Boolean).join("  ·  ") || " ",
      M,
      H - 28,
    );
    doc.text(`${page} / 6`, W - M, H - 28, { align: "right" });
    doc.setTextColor(20, 20, 20);
  };

  const title = (text: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    doc.text(text, M, 120);
    doc.setDrawColor(ORANGE.r, ORANGE.g, ORANGE.b);
    doc.setLineWidth(2);
    doc.line(M, 132, M + 56, 132);
    doc.setTextColor(20, 20, 20);
  };

  const body = (text: string, y: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(text || "—", W - M * 2) as string[];
    doc.text(lines, M, y);
    return y + lines.length * 15;
  };

  // Page 1 — Cover
  doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
  doc.rect(0, 0, W, H, "F");
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", M, 70, 90, 90);
    } catch {
      /* ignore unsupported logo */
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text((workshop?.name ?? "KERJAKU Interior Studio").toUpperCase(), M, 200);
  doc.setFontSize(30);
  doc.text(doc.splitTextToSize(proposal.title, W - M * 2) as string[], M, 260);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(220, 224, 232);
  doc.text(`Prepared for : ${clientName ?? "—"}`, M, 320);
  doc.text(`Project      : ${project?.projectName ?? "—"}`, M, 340);
  doc.text(`Type         : ${project ? PROJECT_TYPE_LABEL[project.projectType] : "—"}`, M, 360);
  doc.text(`Date         : ${formatDate(proposal.createdAt)}`, M, 380);
  doc.setFillColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.rect(M, H - 150, 160, 4, "F");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(
    [workshop?.phone, workshop?.email, workshop?.address, workshop?.city]
      .filter(Boolean)
      .join("  ·  ") || " ",
    M,
    H - 120,
  );

  // Page 2 — Concept
  doc.addPage();
  header("Design Concept");
  title("Design Concept");
  let y = body(proposal.conceptNote ?? "Concept narrative will be provided.", 168);
  if (imageDataUrl) {
    try {
      doc.addImage(imageDataUrl, "JPEG", M, y + 16, W - M * 2, 260);
    } catch {
      /* ignore unsupported image */
    }
  }
  footer(2);

  // Page 3 — Scope of work
  doc.addPage();
  header("Scope of Work");
  title("Scope of Work");
  body(proposal.scopeOfWork ?? "Scope details to be confirmed.", 168);
  footer(3);

  // Page 4 — Material specification
  doc.addPage();
  header("Material Specification");
  title("Material Specification");
  body(proposal.materialSpec ?? "Material specification to be confirmed.", 168);
  footer(4);

  // Page 5 — Bill of quantity
  doc.addPage();
  header("Bill of Quantity");
  title("Bill of Quantity");
  y = 168;
  doc.setFillColor(240, 242, 246);
  doc.rect(M, y - 16, W - M * 2, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Description", M + 8, y);
  doc.text("Qty", W - M - 220, y, { align: "right" });
  doc.text("Price", W - M - 110, y, { align: "right" });
  doc.text("Subtotal", W - M - 8, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 24;
  for (const item of items) {
    if (y > H - 120) {
      footer(5);
      doc.addPage();
      header("Bill of Quantity");
      y = 110;
    }
    const desc = doc.splitTextToSize(item.description || "—", W - M * 2 - 250) as string[];
    doc.text(desc, M + 8, y);
    doc.text(String(item.quantity), W - M - 220, y, { align: "right" });
    doc.text(formatIDR(item.price), W - M - 110, y, { align: "right" });
    doc.text(formatIDR(item.subtotal), W - M - 8, y, { align: "right" });
    y += Math.max(desc.length * 14, 20);
  }
  doc.setDrawColor(200, 205, 214);
  doc.line(M, y + 4, W - M, y + 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TOTAL", M + 8, y + 28);
  doc.setTextColor(ORANGE.r, ORANGE.g, ORANGE.b);
  doc.text(formatIDR(proposal.totalAmount), W - M - 8, y + 28, { align: "right" });
  doc.setTextColor(20, 20, 20);
  footer(5);

  // Page 6 — Terms
  doc.addPage();
  header("Terms & Agreement");
  title("Terms & Agreement");
  body(proposal.terms ?? "Payment terms and warranty to be agreed.", 168);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(workshop?.name ?? "Workshop", M, H - 190);
  doc.line(M, H - 130, M + 180, H - 130);
  doc.text("Authorised signature", M, H - 114);
  doc.text(clientName ?? "Client", W - M - 180, H - 190);
  doc.line(W - M - 180, H - 130, W - M, H - 130);
  doc.text("Client approval", W - M - 180, H - 114);
  footer(6);

  return doc.output("blob");
}

import { formatIDR } from "@/services/domain/models";

export interface WhatsAppProposalInput {
  clientName: string | null;
  workshopName: string | null;
  projectName: string | null;
  proposalTitle: string;
  totalAmount: number;
  shareUrl: string;
}

/** Human, Bahasa-Indonesia proposal delivery message. */
export function buildProposalMessage(input: WhatsAppProposalInput): string {
  return [
    `Halo ${input.clientName ?? "Bapak/Ibu"},`,
    "",
    `Terima kasih atas kepercayaannya kepada ${input.workshopName ?? "KERJAKU Interior"}.`,
    `Berikut kami kirimkan penawaran untuk ${input.projectName ?? input.proposalTitle}.`,
    "",
    `Judul   : ${input.proposalTitle}`,
    `Total   : ${formatIDR(input.totalAmount)}`,
    `Proposal: ${input.shareUrl}`,
    "",
    "Silakan dicek terlebih dahulu, kami siap menyesuaikan bila ada revisi.",
    "Terima kasih 🙏",
  ].join("\n");
}

/** Normalise an Indonesian phone number to WhatsApp wa.me format. */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const number = toWhatsAppNumber(phone);
  const text = encodeURIComponent(message);
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** Short, polite follow-up nudge for a lead. */
export function buildFollowUpMessage(input: {
  clientName: string | null;
  workshopName: string | null;
  projectName?: string | null;
}): string {
  return [
    `Halo ${input.clientName ?? "Bapak/Ibu"},`,
    "",
    `Izin menindaklanjuti rencana ${input.projectName ?? "proyek interior"} yang kemarin kita diskusikan.`,
    "Apakah ada hal yang ingin ditanyakan atau disesuaikan?",
    "",
    `Salam hangat,`,
    `${input.workshopName ?? "KERJAKU Interior"}`,
  ].join("\n");
}

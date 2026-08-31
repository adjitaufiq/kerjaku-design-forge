import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BUCKET = "kerjaku-assets";

export interface PublicProposalItem {
  position: number;
  description: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface PublicProposal {
  title: string;
  status: string;
  conceptNote: string | null;
  scopeOfWork: string | null;
  materialSpec: string | null;
  terms: string | null;
  totalAmount: number;
  createdAt: string;
  projectName: string;
  projectType: string;
  clientName: string | null;
  workshop: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    logoUrl: string | null;
  } | null;
  images: string[];
  pdfUrl: string | null;
}

/**
 * Public, token-gated proposal read. Returns only client-facing fields —
 * no ids, workspace data, internal notes or material codes.
 */
export const getPublicProposal = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(data))
  .handler(async ({ data }): Promise<PublicProposal | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: proposal } = await supabaseAdmin
      .from("proposals")
      .select(
        "id, workspace_id, project_id, title, status, concept_note, scope_of_work, material_spec, terms, total_amount, pdf_url, created_at",
      )
      .eq("share_token", data.token)
      .maybeSingle();

    if (!proposal) return null;

    const [{ data: project }, { data: workshop }, { data: assets }] = await Promise.all([
      supabaseAdmin
        .from("projects")
        .select("project_name, project_type, lead_id")
        .eq("id", proposal.project_id)
        .maybeSingle(),
      supabaseAdmin
        .from("workshops")
        .select("name, phone, email, address, city, logo")
        .eq("workspace_id", proposal.workspace_id)
        .maybeSingle(),
      supabaseAdmin
        .from("project_assets")
        .select("url, type, created_at")
        .eq("project_id", proposal.project_id)
        .order("created_at", { ascending: true }),
    ]);

    let clientName: string | null = null;
    if (project?.lead_id) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("client_name")
        .eq("id", project.lead_id)
        .maybeSingle();
      clientName = lead?.client_name ?? null;
    }

    const sign = async (path: string | null | undefined) => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      return signed?.signedUrl ?? null;
    };

    const images = (
      await Promise.all((assets ?? []).slice(0, 6).map((a) => sign(a.url as string)))
    ).filter((u): u is string => !!u);

    return {
      title: proposal.title,
      status: proposal.status,
      conceptNote: proposal.concept_note,
      scopeOfWork: proposal.scope_of_work,
      materialSpec: proposal.material_spec,
      terms: proposal.terms,
      totalAmount: Number(proposal.total_amount ?? 0),
      createdAt: proposal.created_at,
      projectName: project?.project_name ?? "Interior Project",
      projectType: project?.project_type ?? "OTHER",
      clientName,
      workshop: workshop
        ? {
            name: workshop.name,
            phone: workshop.phone,
            email: workshop.email,
            address: workshop.address,
            city: workshop.city,
            logoUrl: await sign(workshop.logo),
          }
        : null,
      images,
      pdfUrl: await sign(proposal.pdf_url),
    };
  });

export const getPublicProposalItems = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(data))
  .handler(async ({ data }): Promise<PublicProposalItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: proposal } = await supabaseAdmin
      .from("proposals")
      .select("id")
      .eq("share_token", data.token)
      .maybeSingle();
    if (!proposal) return [];
    const { data: items } = await supabaseAdmin
      .from("proposal_items")
      .select("position, description, quantity, price, subtotal")
      .eq("proposal_id", proposal.id)
      .order("position", { ascending: true });
    return (items ?? []).map((i) => ({
      position: Number(i.position ?? 1),
      description: i.description ?? "",
      quantity: Number(i.quantity ?? 1),
      price: Number(i.price ?? 0),
      subtotal: Number(i.subtotal ?? 0),
    }));
  });

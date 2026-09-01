import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, FileDown, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SelectField, TextAreaField, TextField } from "@/components/kerjaku/form-fields";
import { GlassCard, SectionCard } from "@/components/kerjaku/glass-card";
import { PageHeader } from "@/components/kerjaku/page-header";
import { StatusBadge } from "@/components/kerjaku/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/hooks/useWorkspace";
import { buildProposalPdf, PROPOSAL_PAGES, toDataUrl } from "@/lib/proposal-pdf";
import { buildProposalMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { data } from "@/services/data";
import {
  formatDate,
  formatIDR,
  PROJECT_TYPE_LABEL,
  PROPOSAL_STATUS_LABEL,
  type ProposalStatus,
} from "@/services/domain/models";

export const Route = createFileRoute("/_authenticated/proposals/$proposalId")({
  head: () => ({
    meta: [
      { title: "Proposal editor — KERJAKU Interior Studio" },
      {
        name: "description",
        content:
          "Write the six-page proposal, price the bill of quantity and deliver the PDF to your client.",
      },
      { property: "og:title", content: "Proposal editor — KERJAKU Interior Studio" },
      {
        property: "og:description",
        content: "Concept, scope, materials, pricing and terms in one editor with live preview.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProposalEditor,
});

const STATUS_TONE = {
  DRAFT: "neutral",
  SENT: "info",
  APPROVED: "success",
  REJECTED: "warning",
} as const;

type Draft = {
  title: string;
  conceptNote: string;
  scopeOfWork: string;
  materialSpec: string;
  terms: string;
};

function ProposalEditor() {
  const { proposalId } = Route.useParams();
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState<string>(PROPOSAL_PAGES[0]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newItem, setNewItem] = useState({ description: "", quantity: "1", price: "0" });

  const proposalQuery = useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: () => data.proposals.get(proposalId),
  });
  const itemsQuery = useQuery({
    queryKey: ["proposal-items", proposalId],
    queryFn: () => data.proposals.listItems(proposalId),
  });
  const versionsQuery = useQuery({
    queryKey: ["proposal-versions", proposalId],
    queryFn: () => data.proposals.listVersions(proposalId),
  });
  const workshopQuery = useQuery({
    queryKey: ["workshop", workspaceId],
    queryFn: () => data.workspaces.getWorkshop(workspaceId!),
    enabled: !!workspaceId,
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => data.projects.list(workspaceId!),
    enabled: !!workspaceId,
  });
  const leadsQuery = useQuery({
    queryKey: ["leads", workspaceId],
    queryFn: () => data.leads.list(workspaceId!),
    enabled: !!workspaceId,
  });

  const proposal = proposalQuery.data ?? null;
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const project = projectsQuery.data?.find((p) => p.id === proposal?.projectId) ?? null;
  const lead = leadsQuery.data?.find((l) => l.id === project?.leadId) ?? null;
  const workshop = workshopQuery.data ?? null;

  const assetsQuery = useQuery({
    queryKey: ["assets", project?.id],
    queryFn: () => data.assets.listByProject(project!.id),
    enabled: !!project?.id,
  });

  const total = useMemo(() => items.reduce((sum, i) => sum + i.subtotal, 0), [items]);

  useEffect(() => {
    if (proposal && !draft) {
      setDraft({
        title: proposal.title,
        conceptNote: proposal.conceptNote ?? "",
        scopeOfWork: proposal.scopeOfWork ?? "",
        materialSpec: proposal.materialSpec ?? "",
        terms: proposal.terms ?? "",
      });
    }
  }, [proposal, draft]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      await data.proposals.update(proposalId, {
        title: draft.title,
        conceptNote: draft.conceptNote || null,
        scopeOfWork: draft.scopeOfWork || null,
        materialSpec: draft.materialSpec || null,
        terms: draft.terms || null,
        totalAmount: total,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast.success("Proposal saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const setStatus = useMutation({
    mutationFn: (status: ProposalStatus) => data.proposals.update(proposalId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
  });

  const invalidateItems = () => {
    queryClient.invalidateQueries({ queryKey: ["proposal-items", proposalId] });
  };

  const addItem = useMutation({
    mutationFn: () =>
      data.proposals.addItem(workspaceId!, {
        proposalId,
        position: items.length + 1,
        description: newItem.description,
        quantity: Number(newItem.quantity) || 0,
        price: Number(newItem.price) || 0,
      }),
    onSuccess: () => {
      invalidateItems();
      setNewItem({ description: "", quantity: "1", price: "0" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add item"),
  });

  const updateItem = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { description?: string; quantity?: number; price?: number };
    }) => data.proposals.updateItem(id, patch),
    onSuccess: invalidateItems,
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => data.proposals.removeItem(id),
    onSuccess: invalidateItems,
  });

  const generatePdf = useMutation({
    mutationFn: async () => {
      if (!proposal || !draft || !workspaceId) throw new Error("Proposal not ready");
      await data.proposals.update(proposalId, {
        title: draft.title,
        conceptNote: draft.conceptNote || null,
        scopeOfWork: draft.scopeOfWork || null,
        materialSpec: draft.materialSpec || null,
        terms: draft.terms || null,
        totalAmount: total,
      });

      const firstAsset = (assetsQuery.data ?? [])[0];
      const imageUrl = firstAsset ? await data.assets.getViewUrl(firstAsset.url) : null;
      const logoUrl = workshop?.logo ? await data.assets.getViewUrl(workshop.logo) : null;

      const blob = buildProposalPdf({
        proposal: { ...proposal, ...draft, totalAmount: total },
        items,
        project,
        clientName: lead?.clientName ?? null,
        workshop,
        imageDataUrl: await toDataUrl(imageUrl),
        logoDataUrl: await toDataUrl(logoUrl),
      });

      const path = await data.proposals.uploadPdf(workspaceId, proposalId, blob);
      await data.proposals.update(proposalId, { pdfUrl: path });
      const version = (versionsQuery.data?.[0]?.version ?? 0) + 1;
      await data.proposals.addVersion(workspaceId, {
        proposalId,
        version,
        pdfUrl: path,
        totalAmount: total,
      });
      return path;
    },
    onSuccess: async (path) => {
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["proposal-versions", proposalId] });
      const url = await data.proposals.getPdfUrl(path);
      if (url) window.open(url, "_blank", "noopener");
      toast.success("PDF generated and stored");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not generate PDF"),
  });

  const shareUrl =
    typeof window !== "undefined" && proposal
      ? `${window.location.origin}/proposal/${proposal.shareToken}`
      : "";

  const sendWhatsApp = useMutation({
    mutationFn: async () => {
      if (!proposal) return;
      const message = buildProposalMessage({
        clientName: lead?.clientName ?? null,
        workshopName: workshop?.name ?? null,
        projectName: project?.projectName ?? null,
        proposalTitle: draft?.title ?? proposal.title,
        totalAmount: total,
        shareUrl,
      });
      window.open(buildWhatsAppUrl(lead?.phone, message), "_blank", "noopener");
      if (workspaceId && lead) {
        await data.activities.log(workspaceId, {
          leadId: lead.id,
          type: "WHATSAPP",
          title: `Proposal sent via WhatsApp: ${draft?.title ?? proposal.title}`,
          body: `${formatIDR(total)} · ${shareUrl}`,
        });
        await data.leads.update(lead.id, { status: "PROPOSAL" });
      }
      if (proposal.status === "DRAFT") await data.proposals.update(proposalId, { status: "SENT" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Delivery logged");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not log delivery"),
  });

  if (proposalQuery.isLoading || !draft) return <Skeleton className="h-96 rounded-2xl" />;

  if (!proposal) {
    return (
      <GlassCard className="text-center text-sm text-muted-foreground">
        This proposal no longer exists.{" "}
        <Link to="/proposals" className="text-primary-glow underline">
          Back to proposals
        </Link>
      </GlassCard>
    );
  }

  return (
    <>
      <PageHeader
        title={draft.title || "Untitled proposal"}
        subtitle={`${project?.projectName ?? "No project"} · ${lead?.clientName ?? "No client"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/proposals" })}>
              <ArrowLeft className="size-4" /> Proposals
            </Button>
            <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => generatePdf.mutate()}
              disabled={generatePdf.isPending}
            >
              <FileDown className="size-4" />
              {generatePdf.isPending ? "Generating…" : "Generate PDF"}
            </Button>
            <Button
              className="bg-cta text-cta-foreground hover:bg-cta/90"
              onClick={() => sendWhatsApp.mutate()}
              disabled={sendWhatsApp.isPending}
            >
              <MessageCircle className="size-4" /> Open WhatsApp
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Tabs value={page} onValueChange={setPage}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-surface/60">
              {PROPOSAL_PAGES.map((p, i) => (
                <TabsTrigger key={p} value={p} className="text-xs">
                  {i + 1}. {p}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {page === "Cover" ? (
            <SectionCard title="Page 1 — Cover" description="Title block and client identity.">
              <div className="space-y-4">
                <TextField
                  label="Proposal title"
                  name="title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Client" name="client" value={lead?.clientName ?? "—"} readOnly />
                  <TextField
                    label="Project"
                    name="project"
                    value={project?.projectName ?? "—"}
                    readOnly
                  />
                </div>
                <SelectField
                  label="Status"
                  value={proposal.status}
                  onValueChange={(v) => setStatus.mutate(v as ProposalStatus)}
                  options={(
                    ["DRAFT", "SENT", "APPROVED", "REJECTED"] as ProposalStatus[]
                  ).map((s) => ({ value: s, label: PROPOSAL_STATUS_LABEL[s] }))}
                />
              </div>
            </SectionCard>
          ) : null}

          {page === "Concept" ? (
            <SectionCard title="Page 2 — Design concept" description="Narrative and mood.">
              <TextAreaField
                label="Concept note"
                name="concept"
                className="[&_textarea]:min-h-64"
                value={draft.conceptNote}
                onChange={(e) => setDraft({ ...draft, conceptNote: e.target.value })}
              />
            </SectionCard>
          ) : null}

          {page === "Scope of Work" ? (
            <SectionCard title="Page 3 — Scope of work" description="What the workshop delivers.">
              <TextAreaField
                label="Scope of work"
                name="scope"
                className="[&_textarea]:min-h-64"
                value={draft.scopeOfWork}
                onChange={(e) => setDraft({ ...draft, scopeOfWork: e.target.value })}
              />
            </SectionCard>
          ) : null}

          {page === "Material Specification" ? (
            <SectionCard title="Page 4 — Material specification" description="Boards, finishes, hardware.">
              <TextAreaField
                label="Material specification"
                name="material"
                className="[&_textarea]:min-h-64"
                value={draft.materialSpec}
                onChange={(e) => setDraft({ ...draft, materialSpec: e.target.value })}
              />
            </SectionCard>
          ) : null}

          {page === "Bill of Quantity" ? (
            <SectionCard
              title="Page 5 — Bill of quantity"
              description="Subtotals and total update automatically."
            >
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="grid items-center gap-2 rounded-xl border border-border bg-surface/40 p-3 sm:grid-cols-[minmax(0,1fr)_80px_120px_110px_40px]"
                  >
                    <Input
                      defaultValue={item.description}
                      className="bg-surface/60"
                      onBlur={(e) =>
                        e.target.value !== item.description &&
                        updateItem.mutate({ id: item.id, patch: { description: e.target.value } })
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      defaultValue={item.quantity}
                      className="bg-surface/60"
                      onBlur={(e) =>
                        updateItem.mutate({ id: item.id, patch: { quantity: Number(e.target.value) || 0 } })
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      defaultValue={item.price}
                      className="bg-surface/60"
                      onBlur={(e) =>
                        updateItem.mutate({ id: item.id, patch: { price: Number(e.target.value) || 0 } })
                      }
                    />
                    <span className="text-right text-sm text-foreground">
                      {formatIDR(item.subtotal)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove item"
                      onClick={() => removeItem.mutate(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}

                <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[minmax(0,1fr)_80px_120px_110px]">
                  <Input
                    placeholder="Kitchen set bawah 3m — HPL finish"
                    className="bg-surface/60"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={0}
                    className="bg-surface/60"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={0}
                    className="bg-surface/60"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  />
                  <Button
                    variant="outline"
                    disabled={!newItem.description || !workspaceId || addItem.isPending}
                    onClick={() => addItem.mutate()}
                  >
                    <Plus className="size-4" /> Add
                  </Button>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-cta/40 bg-cta/10 px-4 py-3">
                  <span className="text-sm font-medium text-foreground">Total</span>
                  <span className="text-lg font-semibold text-cta">{formatIDR(total)}</span>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {page === "Terms & Agreement" ? (
            <SectionCard title="Page 6 — Terms & agreement" description="Payment, timeline, warranty.">
              <TextAreaField
                label="Terms"
                name="terms"
                className="[&_textarea]:min-h-64"
                value={draft.terms}
                onChange={(e) => setDraft({ ...draft, terms: e.target.value })}
              />
            </SectionCard>
          ) : null}

          <SectionCard title="Versions" description="Every generated PDF is archived.">
            {(versionsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No PDF generated yet.</p>
            ) : (
              <ul className="space-y-2">
                {(versionsQuery.data ?? []).map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-2 text-sm"
                  >
                    <span className="text-foreground">Version {v.version}</span>
                    <span className="text-muted-foreground">
                      {formatIDR(v.totalAmount)} · {formatDate(v.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Live preview */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <SectionCard
            title="Live preview"
            description="What your client sees."
            action={
              shareUrl ? (
                <Button variant="ghost" size="sm" asChild>
                  <a href={shareUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Open link
                  </a>
                </Button>
              ) : undefined
            }
          >
            <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
              <div className="rounded-xl bg-sidebar p-5">
                <p className="text-xs tracking-widest text-muted-foreground uppercase">
                  {workshop?.name ?? "Your workshop"}
                </p>
                <p className="mt-3 text-xl font-semibold text-foreground">
                  {draft.title || "Untitled proposal"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lead?.clientName ?? "Client"} ·{" "}
                  {project ? PROJECT_TYPE_LABEL[project.projectType] : "—"}
                </p>
                <div className="mt-3">
                  <StatusBadge tone={STATUS_TONE[proposal.status]}>
                    {PROPOSAL_STATUS_LABEL[proposal.status]}
                  </StatusBadge>
                </div>
              </div>

              {[
                ["Design concept", draft.conceptNote],
                ["Scope of work", draft.scopeOfWork],
                ["Material specification", draft.materialSpec],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs tracking-widest text-muted-foreground uppercase">{label}</p>
                  <p className="mt-1 text-sm whitespace-pre-line text-foreground">
                    {value || "—"}
                  </p>
                </div>
              ))}

              <div>
                <p className="text-xs tracking-widest text-muted-foreground uppercase">
                  Bill of quantity
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {items.length === 0 ? (
                    <li className="text-muted-foreground">No items yet.</li>
                  ) : (
                    items.map((i) => (
                      <li key={i.id} className="flex justify-between gap-4">
                        <span className="truncate text-foreground">
                          {i.description} × {i.quantity}
                        </span>
                        <span className="text-muted-foreground">{formatIDR(i.subtotal)}</span>
                      </li>
                    ))
                  )}
                </ul>
                <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-medium">
                  <span className="text-foreground">Total</span>
                  <span className="text-cta">{formatIDR(total)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs tracking-widest text-muted-foreground uppercase">
                  Terms &amp; agreement
                </p>
                <p className="mt-1 text-sm whitespace-pre-line text-foreground">
                  {draft.terms || "—"}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}

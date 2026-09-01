import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/kerjaku/data-table";
import { SelectField, TextField } from "@/components/kerjaku/form-fields";
import { Modal } from "@/components/kerjaku/modal";
import { PageHeader } from "@/components/kerjaku/page-header";
import { StatusBadge } from "@/components/kerjaku/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { data } from "@/services/data";
import {
  formatDate,
  formatIDR,
  PROPOSAL_STATUS_LABEL,
  type Proposal,
} from "@/services/domain/models";

export const Route = createFileRoute("/_authenticated/proposals/")({
  head: () => ({
    meta: [
      { title: "Proposals — KERJAKU Interior Studio" },
      {
        name: "description",
        content:
          "Every interior proposal in one place: status, client, total value and last update.",
      },
      { property: "og:title", content: "Proposals — KERJAKU Interior Studio" },
      {
        property: "og:description",
        content: "Draft, send and track interior proposals for your workshop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProposalsPage,
});

const STATUS_TONE = {
  DRAFT: "neutral",
  SENT: "info",
  APPROVED: "success",
  REJECTED: "warning",
} as const;

function ProposalsPage() {
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ projectId: "", title: "" });

  const proposalsQuery = useQuery({
    queryKey: ["proposals", workspaceId],
    queryFn: () => data.proposals.list(workspaceId!),
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

  const projects = projectsQuery.data ?? [];
  const leads = leadsQuery.data ?? [];

  const clientFor = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const lead = leads.find((l) => l.id === project?.leadId);
    return { projectName: project?.projectName ?? "—", clientName: lead?.clientName ?? "—" };
  };

  const create = useMutation({
    mutationFn: () =>
      data.proposals.create(workspaceId!, { projectId: form.projectId, title: form.title }),
    onSuccess: (proposal) => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      setOpen(false);
      setForm({ projectId: "", title: "" });
      toast.success("Proposal created");
      navigate({ to: "/proposals/$proposalId", params: { proposalId: proposal.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create proposal"),
  });

  const columns: Column<Proposal>[] = [
    {
      key: "title",
      header: "Proposal",
      render: (p) => (
        <div>
          <p className="font-medium text-foreground">{p.title}</p>
          <p className="text-xs text-muted-foreground">{clientFor(p.projectId).projectName}</p>
        </div>
      ),
    },
    { key: "client", header: "Client", render: (p) => clientFor(p.projectId).clientName },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <StatusBadge tone={STATUS_TONE[p.status]}>{PROPOSAL_STATUS_LABEL[p.status]}</StatusBadge>
      ),
    },
    { key: "total", header: "Total", render: (p) => formatIDR(p.totalAmount) },
    { key: "created", header: "Created", render: (p) => formatDate(p.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle="Build, price and deliver client-ready proposals"
        actions={
          <Button
            className="bg-cta text-cta-foreground hover:bg-cta/90"
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" /> New proposal
          </Button>
        }
      />

      {proposalsQuery.isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <DataTable
          columns={columns}
          rows={proposalsQuery.data ?? []}
          getRowId={(p) => p.id}
          onRowClick={(p) =>
            navigate({ to: "/proposals/$proposalId", params: { proposalId: p.id } })
          }
          emptyMessage="No proposals yet. Create one from an existing project."
        />
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="New proposal"
        description="Pick the project this proposal belongs to."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={!form.projectId || !form.title || !workspaceId || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="Project"
            value={form.projectId}
            onValueChange={(v) => setForm({ ...form, projectId: v })}
            options={projects.map((p) => ({ value: p.id, label: p.projectName }))}
            placeholder="Select a project…"
          />
          <TextField
            label="Proposal title"
            name="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Kitchen Set Proposal — Bpk. Andi"
          />
        </div>
      </Modal>
    </>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClipboardList, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/kerjaku/data-table";
import { EmptyStateCard } from "@/components/kerjaku/empty-state";
import { SelectField, TextField } from "@/components/kerjaku/form-fields";
import { Modal } from "@/components/kerjaku/modal";
import { PageHeader } from "@/components/kerjaku/page-header";
import { LeadStatusBadge } from "@/components/kerjaku/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { data } from "@/services/data";
import { type Lead } from "@/services/domain/models";

export const Route = createFileRoute("/_authenticated/leads/")({
  head: () => ({
    meta: [
      { title: "Leads — KERJAKU Interior Studio" },
      {
        name: "description",
        content: "All client inquiries for your interior workshop with pipeline stage and contact.",
      },
      { property: "og:title", content: "Leads — KERJAKU Interior Studio" },
      {
        property: "og:description",
        content: "Manage every interior client inquiry from first contact to signed deal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadsPage,
});

const SOURCES = ["Instagram", "WhatsApp", "Referral", "Walk-in", "Website", "Other"];

function LeadsPage() {
  const { workspaceId, isLoading: workspaceLoading } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    phone: "",
    email: "",
    location: "",
    source: "Instagram",
  });

  const leadsQuery = useQuery({
    queryKey: ["leads", workspaceId],
    queryFn: () => data.leads.list(workspaceId!),
    enabled: !!workspaceId,
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => data.projects.list(workspaceId!),
    enabled: !!workspaceId,
  });
  const jobsByLead = new Map<string, string[]>();
  for (const p of projectsQuery.data ?? []) {
    if (!p.leadId) continue;
    const list = jobsByLead.get(p.leadId) ?? [];
    const name = p.projectName.split(" — ")[0]!;
    if (!list.includes(name)) list.push(name);
    jobsByLead.set(p.leadId, list);
  }

  const createLead = useMutation({
    mutationFn: () =>
      data.leads.create(workspaceId!, {
        clientName: form.clientName,
        phone: form.phone || null,
        email: form.email || null,
        location: form.location || null,
        source: form.source,
      }),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setOpen(false);
      setForm({ clientName: "", phone: "", email: "", location: "", source: "Instagram" });
      toast.success("Lead created");
      navigate({ to: "/leads/$leadId", params: { leadId: lead.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create lead"),
  });

  const columns: Column<Lead>[] = [
    {
      key: "name",
      header: "Client",
      render: (l) => <span className="font-medium">{l.clientName}</span>,
    },
    { key: "phone", header: "Phone", render: (l) => l.phone ?? "—" },
    { key: "location", header: "Location", render: (l) => l.location ?? "—" },
    { key: "source", header: "Source", render: (l) => l.source ?? "—" },
    { key: "status", header: "Stage", render: (l) => <LeadStatusBadge status={l.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Every client inquiry in one list"
        actions={
          <Button
            className="bg-cta text-cta-foreground hover:bg-cta/90"
            onClick={() => setOpen(true)}
          >
            <Plus className="size-4" /> New lead
          </Button>
        }
      />

      {workspaceLoading || (!!workspaceId && leadsQuery.isLoading) ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (leadsQuery.data ?? []).length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyStateCard
            icon={UserPlus}
            title="No leads yet"
            description="Start your first client consultation."
            actionLabel="Create Lead"
            onAction={() => setOpen(true)}
          />
          <EmptyStateCard
            icon={ClipboardList}
            title="Create first consultation"
            description="Capture the client brief, budget and style preference."
            actionLabel="Go to Consultation"
            to="/consultation"
          />
        </div>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {(leadsQuery.data ?? []).map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/leads/$leadId", params: { leadId: l.id } })}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-surface/40 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{l.clientName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[l.location, jobsByLead.get(l.id)?.join(", ") || "Belum ada pekerjaan"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <LeadStatusBadge status={l.status} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              rows={leadsQuery.data ?? []}
              getRowId={(l) => l.id}
              onRowClick={(l) => navigate({ to: "/leads/$leadId", params: { leadId: l.id } })}
              emptyMessage="No leads yet. Create your first client inquiry."
            />
          </div>
        </>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="New lead"
        description="Capture the client's contact details."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={!form.clientName || createLead.isPending}
              onClick={() => createLead.mutate()}
            >
              {createLead.isPending ? "Saving…" : "Create lead"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            label="Client name"
            name="clientName"
            value={form.clientName}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            placeholder="Ibu Sari"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="0812…"
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <TextField
            label="Location"
            name="location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Jakarta Selatan"
          />
          <SelectField
            label="Source"
            value={form.source}
            onValueChange={(v) => setForm({ ...form, source: v })}
            options={SOURCES.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </Modal>
    </>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/kerjaku/data-table";
import { SelectField, TextField } from "@/components/kerjaku/form-fields";
import { Modal } from "@/components/kerjaku/modal";
import { PageHeader } from "@/components/kerjaku/page-header";
import { LeadStatusBadge } from "@/components/kerjaku/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { data } from "@/services/data";
import { LEAD_STAGES, LEAD_STATUS_LABEL, type Lead } from "@/services/domain/models";

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
  const { workspaceId } = useWorkspace();
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

      {leadsQuery.isLoading || !workspaceId ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (leadsQuery.data ?? []).length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyStateCard
            icon={UserPlus}
            title="No leads yet"
            description="Start your first client consultation by adding a lead."
            actionLabel="Create Lead"
            to="/leads"
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
        <DataTable
          columns={columns}
          rows={leadsQuery.data ?? []}
          getRowId={(l) => l.id}
          onRowClick={(l) => navigate({ to: "/leads/$leadId", params: { leadId: l.id } })}
          emptyMessage="No leads yet. Create your first client inquiry."
        />
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SelectField, TextAreaField, TextField } from "@/components/kerjaku/form-fields";
import { GlassCard, SectionCard } from "@/components/kerjaku/glass-card";
import { Modal } from "@/components/kerjaku/modal";
import { PageHeader } from "@/components/kerjaku/page-header";
import {
  LeadStatusBadge,
  ProjectStatusBadge,
  StatusBadge,
} from "@/components/kerjaku/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { data } from "@/services/data";
import {
  ACTIVITY_TYPE_LABEL,
  formatDate,
  formatIDR,
  LEAD_STAGES,
  LEAD_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  PROPOSAL_STATUS_LABEL,
  type ActivityType,
} from "@/services/domain/models";

export const Route = createFileRoute("/_authenticated/leads/$leadId")({
  head: () => ({
    meta: [
      { title: "Lead detail — KERJAKU Interior Studio" },
      {
        name: "description",
        content:
          "Client information, linked projects, consultation summary and full activity timeline for one interior lead.",
      },
      { property: "og:title", content: "Lead detail — KERJAKU Interior Studio" },
      {
        property: "og:description",
        content: "Everything about one client: contact, projects, consultation and timeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadDetailPage,
});

const ACTIVITY_TYPES: ActivityType[] = [
  "NOTE",
  "CALL",
  "WHATSAPP",
  "FOLLOW_UP",
  "PROPOSAL_SENT",
  "STAGE_CHANGE",
];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

function LeadDetailPage() {
  const { leadId } = Route.useParams();
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState({ type: "NOTE" as ActivityType, title: "", body: "" });

  const leadQuery = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => data.leads.get(leadId),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", "lead", leadId],
    queryFn: () => data.projects.listByLead(leadId),
  });
  const activitiesQuery = useQuery({
    queryKey: ["activities", leadId],
    queryFn: () => data.activities.listByLead(leadId),
  });

  const projects = projectsQuery.data ?? [];
  const projectIds = projects.map((p) => p.id);

  const proposalsQuery = useQuery({
    queryKey: ["proposals", projectIds],
    queryFn: () => data.proposals.listByProjects(projectIds),
    enabled: projectIds.length > 0,
  });
  const consultationQuery = useQuery({
    queryKey: ["consultation", projectIds[0]],
    queryFn: () => data.consultations.getByProject(projectIds[0]!),
    enabled: !!projectIds[0],
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      await data.leads.update(leadId, { status: status as never });
      if (workspaceId) {
        await data.activities.log(workspaceId, {
          leadId,
          type: "STAGE_CHANGE",
          title: `Stage moved to ${LEAD_STATUS_LABEL[status as never]}`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["activities", leadId] });
      toast.success("Stage updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update stage"),
  });

  const addNote = useMutation({
    mutationFn: () =>
      data.activities.log(workspaceId!, {
        leadId,
        type: note.type,
        title: note.title,
        body: note.body || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities", leadId] });
      setNoteOpen(false);
      setNote({ type: "NOTE", title: "", body: "" });
      toast.success("Note added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add note"),
  });

  if (leadQuery.isLoading) {
    return <Skeleton className="h-72 rounded-2xl" />;
  }

  const lead = leadQuery.data;
  if (!lead) {
    return (
      <GlassCard className="text-center text-sm text-muted-foreground">
        This lead no longer exists.{" "}
        <Link to="/leads" className="text-primary-glow underline">
          Back to leads
        </Link>
      </GlassCard>
    );
  }

  const activities = activitiesQuery.data ?? [];
  const proposals = proposalsQuery.data ?? [];
  const consultation = consultationQuery.data;

  return (
    <>
      <PageHeader
        title={lead.clientName}
        subtitle={`${lead.location ?? "No location"} · ${lead.source ?? "Unknown source"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/leads" })}>
              <ArrowLeft className="size-4" /> Leads
            </Button>
            <Button
              className="bg-cta text-cta-foreground hover:bg-cta/90"
              onClick={() => setNoteOpen(true)}
            >
              <Plus className="size-4" /> Log activity
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Client information">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <InfoRow label="Name" value={lead.clientName} />
              <InfoRow label="Phone" value={lead.phone ?? "—"} />
              <InfoRow label="Email" value={lead.email ?? "—"} />
              <InfoRow label="Location" value={lead.location ?? "—"} />
              <InfoRow label="Source" value={lead.source ?? "—"} />
              <InfoRow label="Created" value={formatDate(lead.createdAt)} />
            </div>
          </SectionCard>

          <SectionCard
            title="Linked projects"
            description="Every job scoped for this client."
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/projects">All projects</Link>
              </Button>
            }
          >
            {projectsQuery.isLoading ? (
              <Skeleton className="h-20 rounded-xl" />
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No project yet. Start one from the{" "}
                <Link to="/consultation" className="text-primary-glow underline">
                  consultation form
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.projectName}</p>
                      <p className="text-xs text-muted-foreground">
                        {PROJECT_TYPE_LABEL[p.projectType]} · {formatDate(p.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-foreground">
                        {formatIDR(p.estimatedValue)}
                      </span>
                      <ProjectStatusBadge status={p.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Consultation summary">
            {consultation ? (
              <div className="grid gap-x-8 sm:grid-cols-2">
                <InfoRow label="Requirement" value={consultation.clientRequirement ?? "—"} />
                <InfoRow label="Budget" value={consultation.budgetRange ?? "—"} />
                <InfoRow label="Style" value={consultation.stylePreference ?? "—"} />
                <InfoRow label="Colour" value={consultation.colorPreference ?? "—"} />
                <InfoRow label="Special request" value={consultation.specialRequest ?? "—"} />
                <InfoRow label="Notes" value={consultation.notes ?? "—"} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No consultation recorded for this client yet.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Activity timeline" description="Notes, calls and stage changes.">
            {activitiesQuery.isLoading ? (
              <Skeleton className="h-24 rounded-xl" />
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <ol className="relative space-y-5 border-l border-border pl-5">
                {activities.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-primary" />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="info">{ACTIVITY_TYPE_LABEL[a.type]}</StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(a.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-foreground">{a.title}</p>
                    {a.body ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{a.body}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Pipeline stage">
            <div className="space-y-3">
              <LeadStatusBadge status={lead.status} />
              <SelectField
                label="Move to stage"
                value={lead.status}
                onValueChange={(v) => updateStatus.mutate(v)}
                options={LEAD_STAGES.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Follow up reminder"
            description="Schedule the next touchpoint and nudge the client."
            action={
              followUpDue ? (
                <StatusBadge tone="warning">Due</StatusBadge>
              ) : lead.nextFollowUp ? (
                <StatusBadge tone="info">Scheduled</StatusBadge>
              ) : undefined
            }
          >
            <div className="space-y-3">
              <InfoRow label="Next follow up" value={formatDate(lead.nextFollowUp)} />
              <TextField
                label="Reminder date"
                name="nextFollowUp"
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!followUpDate || setFollowUp.isPending}
                  onClick={() => setFollowUp.mutate(followUpDate)}
                >
                  <CalendarClock className="size-4" />
                  {setFollowUp.isPending ? "Saving…" : "Set reminder"}
                </Button>
                {lead.nextFollowUp ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={setFollowUp.isPending}
                    onClick={() => setFollowUp.mutate(null)}
                  >
                    Clear
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  className="bg-cta text-cta-foreground hover:bg-cta/90"
                  disabled={sendFollowUp.isPending}
                  onClick={() => sendFollowUp.mutate()}
                >
                  <MessageCircle className="size-4" /> WhatsApp follow up
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Linked proposals">
            {proposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No proposals yet.</p>
            ) : (
              <ul className="space-y-2">
                {proposals.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-border bg-surface/40 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{p.title}</p>
                      <StatusBadge tone="cta">{PROPOSAL_STATUS_LABEL[p.status]}</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatIDR(p.totalAmount)} · {formatDate(p.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <Modal
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title="Log activity"
        description="Keep the client history complete."
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={!note.title || !workspaceId || addNote.isPending}
              onClick={() => addNote.mutate()}
            >
              {addNote.isPending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="Type"
            value={note.type}
            onValueChange={(v) => setNote({ ...note, type: v as ActivityType })}
            options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABEL[t] }))}
          />
          <TextField
            label="Title"
            name="title"
            value={note.title}
            onChange={(e) => setNote({ ...note, title: e.target.value })}
            placeholder="Called client about kitchen layout"
          />
          <TextAreaField
            label="Details"
            name="body"
            value={note.body}
            onChange={(e) => setNote({ ...note, body: e.target.value })}
          />
        </div>
      </Modal>
    </>
  );
}

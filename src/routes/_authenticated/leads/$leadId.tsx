import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calculator,
  CalendarClock,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { EstimateSummary } from "@/components/kerjaku/estimate-summary";
import { LeadFinalVisual } from "@/components/kerjaku/lead-final-visual";
import { INTERIOR_ACTIVITY_TITLE, missingForEstimate, parseInteriorRecord } from "@/lib/interior-spec";
import {
  buildEstimatorUrl,
  ESTIMATE_ACTIVITY_TITLE,
  parseEstimateParam,
  type EstimatePayload,
} from "@/lib/material-estimator";
import { LeadConceptCard } from "@/components/kerjaku/ai-concept-card";
import { ApprovedConcepts } from "@/components/kerjaku/ai-concepts";
import { ConsultationSummary } from "@/components/kerjaku/consultation-summary";
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
import { buildFollowUpMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
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
  validateSearch: (s: Record<string, unknown>): { estimate?: string } =>
    typeof s["estimate"] === "string" ? { estimate: s["estimate"] } : {},
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
      <span className="shrink-0 text-xs tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="min-w-0 break-words text-right text-sm text-foreground">{value}</span>
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
  const [followUpDraft, setFollowUpDraft] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ clientName: string; location: string; phone: string } | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  const saveEdit = useMutation({
    mutationFn: () =>
      data.leads.update(leadId, {
        clientName: edit!.clientName.trim(),
        location: edit!.location.trim() || null,
        phone: edit!.phone.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setEdit(null);
      toast.success("Data klien diperbarui");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan"),
  });

  const removeLead = useMutation({
    mutationFn: () => data.leads.remove(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Klien dihapus");
      navigate({ to: "/leads" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menghapus"),
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

  const setFollowUp = useMutation({
    mutationFn: async (date: string | null) => {
      await data.leads.update(leadId, { nextFollowUp: date });
      if (workspaceId && date) {
        await data.activities.log(workspaceId, {
          leadId,
          type: "FOLLOW_UP",
          title: `Follow up scheduled for ${formatDate(date)}`,
          dueAt: new Date(date).toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["activities", leadId] });
      toast.success("Reminder updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not set reminder"),
  });

  const sendFollowUp = useMutation({
    mutationFn: async () => {
      const current = leadQuery.data;
      if (!current) return;
      const message = buildFollowUpMessage({
        clientName: current.clientName,
        workshopName: null,
        projectName: projects[0]?.projectName ?? null,
      });
      window.open(buildWhatsAppUrl(current.phone, message), "_blank", "noopener");
      if (workspaceId) {
        await data.activities.log(workspaceId, {
          leadId,
          type: "WHATSAPP",
          title: "Follow up sent via WhatsApp",
          body: message,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities", leadId] });
      toast.success("Follow up logged");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not log follow up"),
  });

  const openEstimator = useMutation({
    mutationFn: async (p: (typeof projects)[number]) => {
      const current = leadQuery.data;
      if (!current || !workspaceId) throw new Error("Data klien belum siap");
      const [assets, activities] = await Promise.all([
        data.assets.listByProject(p.id),
        data.activities.listByLead(leadId),
      ]);
      const records = activities
        .filter((a) => a.title === INTERIOR_ACTIVITY_TITLE)
        .map((a) => parseInteriorRecord(a.body))
        .filter((r) => r !== null && r.projectId === p.id);
      const missing = missingForEstimate(records[0]?.specHints);
      if (missing.length) {
        throw new Error(`Spek belum lengkap, isi dulu: ${missing.join(", ")}`);
      }
      const win = window.open("about:blank", "_blank");
      const interiorIds = new Set(records.flatMap((r) => [r?.interiorAssetId, r?.exteriorAssetId]));
      const record = records[0];
      const latest = (type: string) => {
        const a = assets.find((x) => x.type === type && !interiorIds.has(x.id));
        return a ? data.assets.getViewUrl(a.url) : Promise.resolve(null);
      };
      // Final tampak luar (spek diterapkan) diutamakan; jika belum ada pakai After.
      const base =
        assets.find((a) => a.id === record?.exteriorAssetId) ??
        assets.find((a) => a.id === record?.baseAssetId);
      const inside = assets.find((a) => a.id === record?.interiorAssetId);
      const [beforeUrl, renderUrl, interiorUrl] = await Promise.all([
        latest("CLIENT_PHOTO"),
        base ? data.assets.getViewUrl(base.url) : latest("SKETCHUP_RENDER"),
        inside ? data.assets.getViewUrl(inside.url) : Promise.resolve(null),
      ]);
      const url = buildEstimatorUrl({
        projectId: p.id,
        workspaceId,
        leadId,
        clientName: current.clientName,
        phone: current.phone,
        location: current.location,
        projectName: p.projectName,
        projectType: p.projectType,
        notes: consultationQuery.data?.notes ?? null,
        beforeUrl,
        renderUrl,
        interiorUrl,
        specHints: record?.specHints,
        origin: window.location.origin,
      });
      if (win) win.location.href = url;
      else window.location.href = url;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal membuka estimator"),
  });

  // Receive ?estimate=... from Smart Material Estimator and save it once.
  const { estimate: estimateParam } = Route.useSearch();
  const savedEstimate = useRef(false);
  useEffect(() => {
    if (!estimateParam || !workspaceId || savedEstimate.current) return;
    savedEstimate.current = true;
    const parsed = parseEstimateParam(estimateParam);
    navigate({ to: "/leads/$leadId", params: { leadId }, search: {}, replace: true });
    if (!parsed) {
      toast.error("Data estimasi dari estimator tidak terbaca");
      return;
    }
    data.activities
      .log(workspaceId, {
        leadId,
        type: "NOTE",
        title: ESTIMATE_ACTIVITY_TITLE,
        body: JSON.stringify(parsed),
      })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["activities", leadId] });
        toast.success("Hasil estimasi material tersimpan");
      })
      .catch(() => toast.error("Gagal menyimpan estimasi"));
  }, [estimateParam, workspaceId, leadId, navigate, queryClient]);

  // Latest estimate per project, sent back by Smart Material Estimator.
  const estimates = new Map<string, EstimatePayload>();
  for (const a of activitiesQuery.data ?? []) {
    if (a.title !== ESTIMATE_ACTIVITY_TITLE || !a.body) continue;
    const parsed = parseEstimateParam(a.body);
    if (parsed && !estimates.has(parsed.projectId)) estimates.set(parsed.projectId, parsed);
  }

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

  const followUpDate = followUpDraft ?? (lead.nextFollowUp ? lead.nextFollowUp.slice(0, 10) : "");
  const followUpDue = !!lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date();

  const activities = activitiesQuery.data ?? [];
  const proposals = proposalsQuery.data ?? [];
  const consultation = consultationQuery.data;

  return (
    <>
      <PageHeader
        title={lead.clientName}
        subtitle={[lead.location, lead.phone].filter(Boolean).join(" · ") || "—"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/leads" })}>
              <ArrowLeft className="size-4" /> Leads
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setEdit({
                  clientName: lead.clientName,
                  location: lead.location ?? "",
                  phone: lead.phone ?? "",
                })
              }
            >
              <Pencil className="size-4" /> Edit
            </Button>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> Hapus
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

      <div className="mx-auto min-w-0 max-w-3xl space-y-6">
        <SectionCard title="Profil klien">
          <div className="grid gap-x-8 sm:grid-cols-2">
            <InfoRow label="Nama" value={lead.clientName} />
            <InfoRow label="Lokasi" value={lead.location ?? "—"} />
            <InfoRow label="No. WhatsApp" value={lead.phone ?? "—"} />
          </div>
        </SectionCard>

        {projectsQuery.isLoading ? (
          <Skeleton className="h-72 rounded-2xl" />
        ) : projects.length === 0 ? (
          <SectionCard title="Visual final">
            <p className="text-sm text-muted-foreground">
              Belum ada visual final. Simpan dari{" "}
              <Link to="/quick-visual" className="text-primary-glow underline">
                Quick Visual
              </Link>
              .
            </p>
          </SectionCard>
        ) : (
          projects.map((p) => (
            <SectionCard key={p.id} title={p.projectName}>
              <div className="space-y-3">
                <LeadFinalVisual leadId={leadId} projectId={p.id} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/quick-visual">
                      <Pencil className="size-4" /> Edit di Quick Visual
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    disabled={openEstimator.isPending}
                    onClick={() => openEstimator.mutate(p)}
                  >
                    <Calculator className="size-4" /> Hitung Estimasi Material
                  </Button>
                </div>
                {estimates.get(p.id) && <EstimateSummary estimate={estimates.get(p.id)!} />}
              </div>
            </SectionCard>
          ))
        )}
      </div>

      <Modal
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title="Edit klien"
        description="Ubah nama, lokasi atau No. WhatsApp."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEdit(null)}>
              Batal
            </Button>
            <Button
              className="bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={!edit?.clientName.trim() || saveEdit.isPending}
              onClick={() => saveEdit.mutate()}
            >
              {saveEdit.isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        {edit && (
          <div className="space-y-4">
            <TextField
              label="Nama klien"
              name="clientName"
              value={edit.clientName}
              onChange={(e) => setEdit({ ...edit, clientName: e.target.value })}
            />
            <TextField
              label="Lokasi"
              name="location"
              value={edit.location}
              onChange={(e) => setEdit({ ...edit, location: e.target.value })}
            />
            <TextField
              label="No. WhatsApp"
              name="phone"
              inputMode="tel"
              value={edit.phone}
              onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus klien ini?"
        description="Klien beserta semua pekerjaan, foto, proposal dan riwayatnya akan dihapus permanen."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={removeLead.isPending}
              onClick={() => removeLead.mutate()}
            >
              {removeLead.isPending ? "Menghapus…" : "Ya, hapus"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Tindakan ini tidak bisa dibatalkan.</p>
      </Modal>

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

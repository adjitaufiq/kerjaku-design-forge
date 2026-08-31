import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  FileField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/kerjaku/form-fields";
import { SectionCard } from "@/components/kerjaku/glass-card";
import { PageHeader } from "@/components/kerjaku/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { data } from "@/services/data";
import {
  BUDGET_RANGES,
  PROJECT_TYPE_LABEL,
  STYLE_PREFERENCES,
  type ProjectType,
} from "@/services/domain/models";

export const Route = createFileRoute("/_authenticated/consultation")({
  head: () => ({
    meta: [
      { title: "Consultation — KERJAKU Interior Studio" },
      {
        name: "description",
        content:
          "Capture client requirements, budget, style preference and room photos to open a new interior project.",
      },
      { property: "og:title", content: "Consultation — KERJAKU Interior Studio" },
      {
        property: "og:description",
        content: "Turn a client briefing into a structured interior project in minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsultationPage,
});

const PROJECT_TYPES = Object.keys(PROJECT_TYPE_LABEL) as ProjectType[];

function ConsultationPage() {
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    leadId: "",
    projectName: "",
    projectType: "KITCHEN_SET" as ProjectType,
    description: "",
    budget: BUDGET_RANGES[1]!,
    location: "",
    style: STYLE_PREFERENCES[0]!,
    color: "",
    notes: "",
  });
  const [roomPhoto, setRoomPhoto] = useState<File | null>(null);
  const [reference, setReference] = useState<File | null>(null);
  const [render, setRender] = useState<File | null>(null);

  const leadsQuery = useQuery({
    queryKey: ["leads", workspaceId],
    queryFn: () => data.leads.list(workspaceId!),
    enabled: !!workspaceId,
  });

  const submit = useMutation({
    mutationFn: async () => {
      const ws = workspaceId!;
      const project = await data.projects.create(ws, {
        leadId: form.leadId || null,
        projectName: form.projectName,
        projectType: form.projectType,
        status: "DESIGN",
      });

      await data.consultations.create(ws, {
        projectId: project.id,
        clientRequirement: form.description || null,
        budgetRange: form.budget,
        stylePreference: form.style,
        colorPreference: form.color || null,
        specialRequest: form.location ? `Location: ${form.location}` : null,
        notes: form.notes || null,
      });

      const uploads: [File | null, "CLIENT_PHOTO" | "PINTEREST_REFERENCE" | "SKETCHUP_RENDER"][] = [
        [roomPhoto, "CLIENT_PHOTO"],
        [reference, "PINTEREST_REFERENCE"],
        [render, "SKETCHUP_RENDER"],
      ];
      for (const [file, type] of uploads) {
        if (file) await data.assets.upload(ws, project.id, type, file);
      }

      if (form.leadId) {
        await data.leads.update(form.leadId, { status: "CONSULTATION" });
        await data.activities.log(ws, {
          leadId: form.leadId,
          type: "NOTE",
          title: `Consultation recorded for ${project.projectName}`,
          body: form.description || null,
        });
      }

      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries();
      toast.success("Consultation saved");
      if (project.leadId) {
        navigate({ to: "/leads/$leadId", params: { leadId: project.leadId } });
      } else {
        navigate({ to: "/projects" });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save consultation"),
  });

  const leads = leadsQuery.data ?? [];
  const canSubmit = !!workspaceId && !!form.leadId && !!form.projectName && !submit.isPending;

  return (
    <>
      <PageHeader
        title="Consultation"
        subtitle="Capture the client briefing and open a project"
      />

      {!workspaceId ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SectionCard title="Client & project">
              <div className="space-y-4">
                <SelectField
                  label="Client"
                  value={form.leadId}
                  onValueChange={(v) => setForm({ ...form, leadId: v })}
                  placeholder={leads.length ? "Select a client…" : "No leads yet"}
                  hint="Consultations are always tied to an existing lead."
                  options={leads.map((l) => ({ value: l.id, label: l.clientName }))}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Project name"
                    name="projectName"
                    value={form.projectName}
                    onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                    placeholder="Kitchen set Bu Sari"
                  />
                  <SelectField
                    label="Project type"
                    value={form.projectType}
                    onValueChange={(v) => setForm({ ...form, projectType: v as ProjectType })}
                    options={PROJECT_TYPES.map((t) => ({
                      value: t,
                      label: PROJECT_TYPE_LABEL[t],
                    }))}
                  />
                </div>
                <TextAreaField
                  label="Description"
                  name="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does the client need?"
                />
              </div>
            </SectionCard>

            <SectionCard title="Preferences">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Budget"
                  value={form.budget}
                  onValueChange={(v) => setForm({ ...form, budget: v })}
                  options={BUDGET_RANGES.map((b) => ({ value: b, label: b }))}
                />
                <TextField
                  label="Location"
                  name="location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Bintaro, Tangerang Selatan"
                />
                <SelectField
                  label="Style preference"
                  value={form.style}
                  onValueChange={(v) => setForm({ ...form, style: v })}
                  options={STYLE_PREFERENCES.map((s) => ({ value: s, label: s }))}
                />
                <TextField
                  label="Colour preference"
                  name="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="Warm oak + off white"
                />
              </div>
              <TextAreaField
                className="mt-4"
                label="Internal notes"
                name="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard title="Uploads" description="Stored with the project assets.">
              <div className="space-y-4">
                <FileField
                  label="Existing room photo"
                  file={roomPhoto}
                  onFileChange={setRoomPhoto}
                />
                <FileField
                  label="Reference image"
                  file={reference}
                  onFileChange={setReference}
                />
                <FileField
                  label="Render (optional)"
                  hint="SketchUp or 3D render if you already have one."
                  file={render}
                  onFileChange={setRender}
                />
              </div>
            </SectionCard>

            <Button
              className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={!canSubmit}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? "Saving…" : "Save consultation"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

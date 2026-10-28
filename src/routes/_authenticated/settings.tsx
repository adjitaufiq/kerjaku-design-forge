import { AiLibraryCard } from "@/components/kerjaku/ai-concept-card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { TextAreaField, TextField } from "@/components/kerjaku/form-fields";
import { SectionCard } from "@/components/kerjaku/glass-card";
import { PageHeader } from "@/components/kerjaku/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { aiData } from "@/services/ai";
import { data } from "@/services/data";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Workshop Settings — KERJAKU Interior Studio" },
      {
        name: "description",
        content:
          "Set your workshop name, logo, phone and address — used on every client-facing proposal.",
      },
      { property: "og:title", content: "Workshop Settings — KERJAKU Interior Studio" },
      {
        property: "og:description",
        content: "Workshop identity details that appear on your interior proposals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { workspaceId, role } = useWorkspace();
  const queryClient = useQueryClient();

  const workshopQuery = useQuery({
    queryKey: ["workshop", workspaceId],
    queryFn: () => data.workspaces.getWorkshop(workspaceId!),
    enabled: !!workspaceId,
  });

  const [form, setForm] = useState({
    name: "",
    logo: "",
    phone: "",
    email: "",
    address: "",
    city: "",
  });

  useEffect(() => {
    const w = workshopQuery.data;
    if (!w) return;
    setForm({
      name: w.name ?? "",
      logo: w.logo ?? "",
      phone: w.phone ?? "",
      email: w.email ?? "",
      address: w.address ?? "",
      city: w.city ?? "",
    });
  }, [workshopQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      data.workspaces.updateWorkshop(workshopQuery.data!.id, {
        name: form.name,
        logo: form.logo || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workshop"] });
      toast.success("Workshop settings saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save settings"),
  });

  const isAdmin = role === "admin_workshop";
  const workshop = workshopQuery.data;

  return (
    <>
      <PageHeader title="Workshop Settings" subtitle="These details appear on client proposals" />

      {workshopQuery.isLoading || !workspaceId ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : !workshop ? (
        <SectionCard title="No workshop profile">
          <p className="text-sm text-muted-foreground">
            Your workspace has no workshop profile yet. Ask an admin to create one.
          </p>
        </SectionCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SectionCard title="Identity">
              <div className="space-y-4">
                <TextField
                  label="Workshop name"
                  name="name"
                  value={form.name}
                  disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <TextField
                  label="Logo URL"
                  name="logo"
                  value={form.logo}
                  disabled={!isAdmin}
                  hint="Link to your logo image; used on proposals."
                  onChange={(e) => setForm({ ...form, logo: e.target.value })}
                  placeholder="https://…"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Phone"
                    name="phone"
                    value={form.phone}
                    disabled={!isAdmin}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <TextField
                    label="Email"
                    name="email"
                    type="email"
                    value={form.email}
                    disabled={!isAdmin}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <TextAreaField
                  label="Address"
                  name="address"
                  value={form.address}
                  disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
                <TextField
                  label="City"
                  name="city"
                  value={form.city}
                  disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
                <Button
                  className="bg-cta text-cta-foreground hover:bg-cta/90"
                  disabled={!isAdmin || !form.name || save.isPending}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? "Saving…" : "Save changes"}
                </Button>
                {!isAdmin ? (
                  <p className="text-xs text-muted-foreground">
                    Only workshop admins can change these details.
                  </p>
                ) : null}
              </div>
            </SectionCard>

            <AiSettingsCard workspaceId={workspaceId!} isAdmin={isAdmin} />
            <AiLibraryCard workspaceId={workspaceId!} isAdmin={isAdmin} />
          </div>

          <SectionCard title="Preview" description="How it appears on a proposal header.">
            <div className="rounded-xl border border-border bg-surface/40 p-4">
              {form.logo ? (
                <img
                  src={form.logo}
                  alt={`${form.name || "Workshop"} logo`}
                  loading="lazy"
                  className="mb-3 h-12 w-auto object-contain"
                />
              ) : null}
              <p className="text-base font-semibold text-foreground">{form.name || "—"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{form.phone || "—"}</p>
              <p className="text-sm text-muted-foreground">
                {[form.address, form.city].filter(Boolean).join(", ") || "—"}
              </p>
            </div>
          </SectionCard>
        </div>
      )}
    </>
  );
}

function AiSettingsCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["ai-settings", workspaceId],
    queryFn: () => aiData.getSettings(workspaceId),
    enabled: !!workspaceId,
  });
  const creditsQuery = useQuery({
    queryKey: ["ai-credits", workspaceId],
    queryFn: () => aiData.getCredits(workspaceId),
    enabled: !!workspaceId,
  });

  const [form, setForm] = useState({
    defaultModel: "",
    costPreview: 1,
    costStandard: 2,
    costHigh: 3,
    costRevision: 2,
    dailyLimit: 20,
  });

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setForm({
      defaultModel: s.defaultModel,
      costPreview: s.costPreview,
      costStandard: s.costStandard,
      costHigh: s.costHigh,
      costRevision: s.costRevision,
      dailyLimit: s.dailyLimit,
    });
  }, [settingsQuery.data]);

  const save = useMutation({
    mutationFn: () => aiData.updateSettings(settingsQuery.data!.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      toast.success("AI settings saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save AI settings"),
  });

  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <SectionCard
      title="AI Interior"
      description={`Credit balance: ${creditsQuery.data?.balance ?? 0}`}
    >
      {settingsQuery.isLoading ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : !settingsQuery.data ? (
        <p className="text-sm text-muted-foreground">
          AI settings are created automatically with your first generation.
        </p>
      ) : (
        <div className="space-y-4">
          <TextField
            label="Default image model"
            name="defaultModel"
            value={form.defaultModel}
            disabled={!isAdmin}
            onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Preview cost"
              name="costPreview"
              type="number"
              value={String(form.costPreview)}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, costPreview: num(e.target.value) })}
            />
            <TextField
              label="Standard cost"
              name="costStandard"
              type="number"
              value={String(form.costStandard)}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, costStandard: num(e.target.value) })}
            />
            <TextField
              label="High quality cost"
              name="costHigh"
              type="number"
              value={String(form.costHigh)}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, costHigh: num(e.target.value) })}
            />
            <TextField
              label="Revision cost"
              name="costRevision"
              type="number"
              value={String(form.costRevision)}
              disabled={!isAdmin}
              onChange={(e) => setForm({ ...form, costRevision: num(e.target.value) })}
            />
          </div>
          <TextField
            label="Daily generation limit"
            name="dailyLimit"
            type="number"
            value={String(form.dailyLimit)}
            disabled={!isAdmin}
            onChange={(e) => setForm({ ...form, dailyLimit: num(e.target.value) })}
          />
          <Button
            className="bg-cta text-cta-foreground hover:bg-cta/90"
            disabled={!isAdmin || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save AI settings"}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

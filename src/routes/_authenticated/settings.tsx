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
      <PageHeader
        title="Workshop Settings"
        subtitle="These details appear on client proposals"
      />

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

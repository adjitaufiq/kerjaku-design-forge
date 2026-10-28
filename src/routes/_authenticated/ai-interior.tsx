import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Maximize2, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AiConsultantPanel } from "@/components/kerjaku/ai-consultant";
import { DesignConceptsPanel } from "@/components/kerjaku/ai-concept-card";
import { EmptyStateCard } from "@/components/kerjaku/empty-state";
import { FileField, SelectField, TextAreaField } from "@/components/kerjaku/form-fields";
import { GlassCard, SectionCard } from "@/components/kerjaku/glass-card";
import { PageHeader } from "@/components/kerjaku/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { generateInterior, setGenerationApproval } from "@/lib/ai-interior.functions";
import { aiData } from "@/services/ai";
import {
  COLOR_PREFERENCES,
  GENERATION_TYPE_LABEL,
  type AiGeneration,
  type GenerationType,
} from "@/services/domain/ai";
import { data } from "@/services/data";
import { formatDate, STYLE_PREFERENCES } from "@/services/domain/models";

export const Route = createFileRoute("/_authenticated/ai-interior")({
  head: () => ({
    meta: [
      { title: "AI Interior — KERJAKU Interior Studio" },
      {
        name: "description",
        content:
          "Turn a client room photo into a photorealistic interior concept while preserving room geometry and perspective.",
      },
      { property: "og:title", content: "AI Interior — KERJAKU Interior Studio" },
      {
        property: "og:description",
        content: "Photorealistic interior concepts generated from real room photos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiInteriorPage,
});

function BeforeAfter({ before, after }: { before: string | null; after: string | null }) {
  const [pos, setPos] = useState(50);
  const [full, setFull] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  if (!after) {
    return (
      <div className="grid aspect-4/3 w-full place-items-center rounded-2xl border border-dashed border-border bg-surface/40 text-sm text-muted-foreground">
        {before ? "Generate a concept to see the result here" : "Upload a room photo to begin"}
      </div>
    );
  }

  return (
    <div className={full ? "fixed inset-0 z-50 grid place-items-center bg-background/95 p-4" : ""}>
      <div className={full ? "w-full max-w-5xl" : ""}>
        <div
          ref={boxRef}
          className="relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-border bg-surface"
        >
          <img
            src={after}
            alt="AI interior concept"
            className="absolute inset-0 size-full object-cover"
          />
          {before ? (
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
              <img
                src={before}
                alt="Original room"
                className="absolute inset-0 h-full object-cover"
                style={{ width: boxRef.current?.clientWidth ?? "100%" }}
              />
            </div>
          ) : null}
          <div className="absolute top-3 left-3 rounded-md bg-background/70 px-2 py-1 text-xs">
            Before
          </div>
          <div className="absolute top-3 right-3 rounded-md bg-background/70 px-2 py-1 text-xs">
            After
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-3 bottom-3 bg-background/70"
            aria-label="Toggle fullscreen"
            onClick={() => setFull((v) => !v)}
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>
        {before ? (
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            aria-label="Compare before and after"
            onChange={(e) => setPos(Number(e.target.value))}
            className="mt-3 w-full accent-[var(--color-primary)]"
          />
        ) : null}
      </div>
    </div>
  );
}

function AiInteriorPage() {
  const { workspaceId, role, isLoading: workspaceLoading } = useWorkspace();
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState("");
  const [style, setStyle] = useState(STYLE_PREFERENCES[0]!);
  const [color, setColor] = useState(COLOR_PREFERENCES[0]!);
  const [quality, setQuality] = useState<GenerationType>("STANDARD");
  const [instruction, setInstruction] = useState("");
  const [roomFile, setRoomFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<AiGeneration | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);

  const canGenerate = role === "admin_workshop" || role === "designer";

  const projectsQuery = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => data.projects.list(workspaceId!),
    enabled: !!workspaceId,
  });
  const creditsQuery = useQuery({
    queryKey: ["ai-credits", workspaceId],
    queryFn: () => aiData.getCredits(workspaceId!),
    enabled: !!workspaceId,
  });
  const settingsQuery = useQuery({
    queryKey: ["ai-settings", workspaceId],
    queryFn: () => aiData.getSettings(workspaceId!),
    enabled: !!workspaceId,
  });
  const historyQuery = useQuery({
    queryKey: ["ai-generations", workspaceId, projectId],
    queryFn: () => aiData.listGenerations(workspaceId!, projectId || null),
    enabled: !!workspaceId,
  });

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const history = historyQuery.data ?? [];

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0]!.id);
  }, [projects, projectId]);

  useEffect(() => {
    let active = true;
    async function resolve() {
      if (!selected) return;
      const [before, after] = await Promise.all([
        selected.inputImageUrl ? aiData.getImageUrl(selected.inputImageUrl) : null,
        selected.outputImageUrl ? aiData.getImageUrl(selected.outputImageUrl) : null,
      ]);
      if (!active) return;
      setBeforeUrl(before);
      setAfterUrl(after);
    }
    void resolve();
    return () => {
      active = false;
    };
  }, [selected]);

  const localPreview = useMemo(() => (roomFile ? URL.createObjectURL(roomFile) : null), [roomFile]);
  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview],
  );

  const cost = (() => {
    const s = settingsQuery.data;
    if (!s) return null;
    return quality === "PREVIEW"
      ? s.costPreview
      : quality === "HIGH"
        ? s.costHigh
        : quality === "REVISION"
          ? s.costRevision
          : s.costStandard;
  })();

  const generate = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      if (!projectId) throw new Error("Select a project first");

      let inputPath = selected?.outputImageUrl ?? null;
      if (roomFile) {
        const asset = await data.assets.upload(workspaceId, projectId, "CLIENT_PHOTO", roomFile);
        inputPath = asset.url;
      }
      if (!inputPath) throw new Error("Upload a room photo first");

      let referencePath: string | null = null;
      if (referenceFile) {
        const ref = await data.assets.upload(
          workspaceId,
          projectId,
          "PINTEREST_REFERENCE",
          referenceFile,
        );
        referencePath = ref.url;
      }

      return generateInterior({
        data: {
          projectId,
          generationType: quality,
          style,
          colorPreference: color,
          instruction: instruction || null,
          inputImagePath: inputPath,
          referenceImagePath: referencePath,
          previousGenerationId: !roomFile && selected ? selected.id : null,
        },
      });
    },
    onSuccess: async (result) => {
      toast.success(`Concept v${result.version} ready — ${result.cost} credits used`);
      setRoomFile(null);
      setReferenceFile(null);
      await queryClient.invalidateQueries({ queryKey: ["ai-generations"] });
      await queryClient.invalidateQueries({ queryKey: ["ai-credits"] });
      const fresh = await aiData.listGenerations(workspaceId!, projectId || null);
      setSelected(fresh.find((g) => g.id === result.id) ?? fresh[0] ?? null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approve = useMutation({
    mutationFn: async (generation: AiGeneration) =>
      setGenerationApproval({
        data: { generationId: generation.id, approved: !generation.approved },
      }),
    onSuccess: async () => {
      toast.success("Concept updated");
      await queryClient.invalidateQueries({ queryKey: ["ai-generations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (workspaceLoading) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <>
      <PageHeader
        title="AI Interior"
        subtitle="Photorealistic concepts from real room photos — geometry preserved"
        actions={
          <span className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-muted-foreground">
            AI credits:{" "}
            <strong className="text-foreground">{creditsQuery.data?.balance ?? 0}</strong>
          </span>
        }
      />

      {projects.length === 0 ? (
        <EmptyStateCard
          icon={Sparkles}
          title="No projects yet"
          description="AI concepts are generated for an existing project. Start with a consultation brief."
          actionLabel="Go to Consultation"
          to="/consultation"
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
          <SectionCard title="Input" description="Room photo and design direction">
            <div className="space-y-4">
              <SelectField
                label="Project"
                value={projectId}
                onValueChange={setProjectId}
                options={projects.map((p) => ({ value: p.id, label: p.projectName }))}
              />
              <FileField
                label="Existing room photo"
                hint={
                  selected && !roomFile ? "Leave empty to revise the selected concept" : undefined
                }
                file={roomFile}
                onFileChange={setRoomFile}
              />
              <FileField
                label="Reference image (optional)"
                file={referenceFile}
                onFileChange={setReferenceFile}
              />
              <SelectField
                label="Design style"
                value={style}
                onValueChange={setStyle}
                options={STYLE_PREFERENCES.map((s) => ({ value: s, label: s }))}
              />
              <SelectField
                label="Colour preference"
                value={color}
                onValueChange={setColor}
                options={COLOR_PREFERENCES.map((c) => ({ value: c, label: c }))}
              />
              <TextAreaField
                label="Instruction"
                name="instruction"
                placeholder="e.g. glossy white cabinets, warm wood island, hidden LED under the top cabinets"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
            </div>
          </SectionCard>

          <div className="space-y-4">
            <GlassCard>
              <BeforeAfter before={beforeUrl ?? localPreview} after={afterUrl} />
              {selected ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium text-foreground">
                      Version {selected.version} · {GENERATION_TYPE_LABEL[selected.generationType]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selected.style ?? "—"} · {formatDate(selected.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant={selected.approved ? "secondary" : "outline"}
                    onClick={() => approve.mutate(selected)}
                    disabled={approve.isPending || selected.status !== "SUCCESS"}
                  >
                    <Check className="size-4" />
                    {selected.approved ? "Approved" : "Approve concept"}
                  </Button>
                </div>
              ) : null}
            </GlassCard>
          </div>

          <SectionCard title="AI controls" description="Quality, cost and history">
            <div className="space-y-4">
              <SelectField
                label="Quality"
                value={quality}
                onValueChange={(v) => setQuality(v as GenerationType)}
                options={(["PREVIEW", "STANDARD", "HIGH", "REVISION"] as GenerationType[]).map(
                  (t) => ({ value: t, label: GENERATION_TYPE_LABEL[t] }),
                )}
              />
              <p className="text-xs text-muted-foreground">
                Cost: {cost ?? "—"} credits · deducted only when a concept is produced.
              </p>
              <Button
                className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
                disabled={!canGenerate || generate.isPending || !projectId}
                onClick={() => generate.mutate()}
              >
                <Wand2 className="size-4" />
                {generate.isPending
                  ? "Generating…"
                  : selected && !roomFile
                    ? "Generate revision"
                    : "Generate concept"}
              </Button>
              {!canGenerate ? (
                <p className="text-xs text-muted-foreground">
                  Only designers and workshop admins can generate concepts.
                </p>
              ) : null}

              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
                  History
                </p>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No concepts generated yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {history.map((g) => (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(g)}
                          className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                            selected?.id === g.id
                              ? "border-primary/60 bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span className="font-medium">v{g.version}</span> ·{" "}
                          {GENERATION_TYPE_LABEL[g.generationType]}
                          {g.approved ? " · approved" : ""}
                          <span className="block text-xs">
                            {g.status === "SUCCESS" ? formatDate(g.createdAt) : g.status}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {projects.length > 0 && projectId ? (
        <div className="mt-5">
          <AiConsultantPanel
            workspaceId={workspaceId}
            projectId={projectId}
            roomImagePath={selected?.inputImageUrl ?? selected?.outputImageUrl ?? null}
            canRun={canGenerate}
          />
          <div className="mt-5">
            <DesignConceptsPanel
              projectId={projectId}
              generationId={selected?.id ?? null}
              imagePath={selected?.outputImageUrl ?? selected?.inputImageUrl ?? null}
              canRun={canGenerate}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileText, FolderPlus, Presentation, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SelectField, TextAreaField, TextField } from "@/components/kerjaku/form-fields";
import { SectionCard } from "@/components/kerjaku/glass-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createProposalFromConcept,
  generateConcept,
  updateConcept,
} from "@/lib/ai-concept.functions";
import { aiData, conceptData } from "@/services/ai";
import { data } from "@/services/data";
import {
  CONCEPT_STAGES,
  CONCEPT_STATUS_LABEL,
  CUSTOMER_INTEREST_LEVELS,
  LIBRARY_KIND_LABEL,
  type DesignConcept,
  type LibraryKind,
} from "@/services/domain/concept";

export function useConceptImage(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) return setUrl(null);
    if (path.startsWith("http")) return setUrl(path);
    aiData
      .getImageUrl(path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

function useConceptActions(onDone?: () => void) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const update = useServerFn(updateConcept);
  const toProposal = useServerFn(createProposalFromConcept);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["ai-concepts"] });
    onDone?.();
  };
  const patch = useMutation({
    mutationFn: (input: Parameters<typeof update>[0]["data"]) => update({ data: input }),
    onSuccess: () => {
      toast.success("Concept updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const proposal = useMutation({
    mutationFn: (conceptId: string) => toProposal({ data: { conceptId } }),
    onSuccess: (r) => {
      refresh();
      void navigate({ to: "/proposals/$proposalId", params: { proposalId: r.proposalId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const project = useMutation({
    mutationFn: async ({ concept, leadId }: { concept: DesignConcept; leadId: string | null }) => {
      const created = await data.projects.create(concept.workspaceId, {
        leadId,
        projectName: concept.name,
        projectType: "OTHER",
        status: "DESIGN",
      });
      await data.consultations
        .create(concept.workspaceId, {
          projectId: created.id,
          clientRequirement: concept.philosophy,
          stylePreference: concept.style,
          colorPreference: concept.colorPalette,
          specialRequest: concept.revisionRequest,
          notes: [
            `AI concept: ${concept.name}`,
            concept.materialDirection,
            concept.customerNotes,
            concept.scopeOfWork.length ? `Scope:\n- ${concept.scopeOfWork.join("\n- ")}` : null,
          ]
            .filter(Boolean)
            .join("\n\n"),
        })
        .catch(() => null);
      await update({ data: { conceptId: concept.id, status: "CONVERTED" } });
      return created;
    },
    onSuccess: () => {
      toast.success("Project created from concept");
      void qc.invalidateQueries({ queryKey: ["projects"] });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return { patch, proposal, project };
}

/** Full concept workspace on the AI Interior page. */
export function DesignConceptsPanel({
  projectId,
  generationId,
  imagePath,
  canRun,
}: {
  projectId: string;
  generationId: string | null;
  imagePath: string | null;
  canRun: boolean;
}) {
  const qc = useQueryClient();
  const run = useServerFn(generateConcept);
  const query = useQuery({
    queryKey: ["ai-concepts", "project", projectId],
    queryFn: () => conceptData.listByProject(projectId),
  });
  const concepts = query.data ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = concepts.find((c) => c.id === activeId) ?? concepts[0] ?? null;

  const gen = useMutation({
    mutationFn: () => run({ data: { projectId, generationId, imagePath } }),
    onSuccess: (r) => {
      toast.success("Design concept generated");
      setActiveId(r.id);
      void qc.invalidateQueries({ queryKey: ["ai-concepts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      title="AI design concept"
      description="Turn the visualisation into a presentable concept, then a proposal and a project."
      action={
        <Button onClick={() => gen.mutate()} disabled={!canRun || gen.isPending}>
          <Sparkles className="mr-2 h-4 w-4" />
          {gen.isPending ? "Writing concept…" : "Generate concept"}
        </Button>
      }
    >
      {query.isLoading ? (
        <Skeleton className="h-40" />
      ) : concepts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No concept yet. Pick a room photo or visualisation above, then generate a concept.
        </p>
      ) : (
        <div className="space-y-4">
          {concepts.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {concepts.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={c.id === active?.id ? "secondary" : "outline"}
                  onClick={() => setActiveId(c.id)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          ) : null}
          {active ? <ConceptDetail concept={active} /> : null}
        </div>
      )}
    </SectionCard>
  );
}

function ConceptDetail({ concept }: { concept: DesignConcept }) {
  const { patch, proposal } = useConceptActions();
  const [notes, setNotes] = useState(concept.customerNotes ?? "");
  const [revision, setRevision] = useState(concept.revisionRequest ?? "");
  useEffect(() => {
    setNotes(concept.customerNotes ?? "");
    setRevision(concept.revisionRequest ?? "");
  }, [concept.id, concept.customerNotes, concept.revisionRequest]);
  const tiers = (["premium", "standard", "budget"] as const)
    .map((k) => concept.materials[k])
    .filter(Boolean);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4 text-sm">
        <div>
          <h3 className="font-display text-xl">{concept.name}</h3>
          <p className="mt-1 text-muted-foreground">{concept.philosophy}</p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ["Style", concept.style],
            ["Colour", concept.colorPalette],
            ["Material", concept.materialDirection],
            ["Furniture", concept.furnitureRecommendation],
            ["Lighting", concept.lightingRecommendation],
            ["Why it fits", concept.reason],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border/60 p-3">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="mt-1">{v || "—"}</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-3 md:grid-cols-3">
          {tiers.map((t) => (
            <div key={t!.label} className="rounded-lg border border-border/60 p-3">
              <p className="font-medium">{t!.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t!.summary}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {t!.items.map((i, idx) => (
                  <li key={idx}>
                    <span className="text-foreground">{i.area}:</span> {i.material} · {i.finishing}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <SelectField
          label="Approval status"
          value={concept.status}
          onValueChange={(v) => patch.mutate({ conceptId: concept.id, status: v })}
          options={CONCEPT_STAGES.map((s) => ({ value: s, label: CONCEPT_STATUS_LABEL[s] }))}
        />
        <SelectField
          label="Customer interest"
          value={concept.customerInterest ?? ""}
          onValueChange={(v) => patch.mutate({ conceptId: concept.id, customerInterest: v })}
          options={CUSTOMER_INTEREST_LEVELS.map((s) => ({ value: s, label: s }))}
          placeholder="Not set"
        />
        <TextAreaField
          label="Customer notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <TextAreaField
          label="Revision request"
          value={revision}
          onChange={(e) => setRevision(e.target.value)}
        />
        {concept.approvedAt ? (
          <p className="text-xs text-muted-foreground">
            Approved {new Date(concept.approvedAt).toLocaleDateString("id-ID")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={patch.isPending}
            onClick={() =>
              patch.mutate({
                conceptId: concept.id,
                customerNotes: notes,
                revisionRequest: revision,
              })
            }
          >
            Save notes
          </Button>
          <Button variant="outline" asChild>
            <Link to="/concepts/$conceptId" params={{ conceptId: concept.id }}>
              <Presentation className="mr-2 h-4 w-4" />
              Present
            </Link>
          </Button>
          <Button disabled={proposal.isPending} onClick={() => proposal.mutate(concept.id)}>
            <FileText className="mr-2 h-4 w-4" />
            {concept.proposalId ? "Open proposal" : "Create proposal"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** CRM card on the lead page summarising AI concept progress. */
export function LeadConceptCard({
  projectIds,
  leadId,
}: {
  projectIds: string[];
  leadId: string;
}) {
  const query = useQuery({
    queryKey: ["ai-concepts", "projects", projectIds],
    queryFn: () => conceptData.listByProjects(projectIds),
    enabled: projectIds.length > 0,
  });
  const latest = query.data?.[0] ?? null;
  const image = useConceptImage(latest?.imageUrl ?? null);
  const { project } = useConceptActions();

  return (
    <SectionCard title="AI concept" description="Design concept progress for this customer.">
      {query.isLoading ? (
        <Skeleton className="h-24" />
      ) : !latest ? (
        <div className="space-y-2 text-sm">
          <p>
            AI concept generated: <strong>No</strong>
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/ai-interior">Open AI Interior</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {image ? (
            <img src={image} alt={latest.name} className="aspect-video w-full rounded-lg object-cover" />
          ) : null}
          <p>
            AI concept generated: <strong>Yes</strong> · {latest.name}
          </p>
          <p>Status: {CONCEPT_STATUS_LABEL[latest.status]}</p>
          <p>Customer interest: {latest.customerInterest ?? "—"}</p>
          <p>Next action: {latest.nextAction ?? "—"}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/concepts/$conceptId" params={{ conceptId: latest.id }}>
                Present
              </Link>
            </Button>
            <Button
              size="sm"
              disabled={project.isPending || latest.status === "CONVERTED"}
              onClick={() => project.mutate({ concept: latest, leadId })}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              {latest.status === "CONVERTED" ? "Project created" : "Create Project"}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

const KINDS = Object.keys(LIBRARY_KIND_LABEL) as LibraryKind[];

/** Admin-managed libraries used by concept & proposal generation. */
export function AiLibraryCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const key = ["ai-libraries", workspaceId];
  const query = useQuery({ queryKey: key, queryFn: () => conceptData.listLibrary(workspaceId) });
  const [kind, setKind] = useState<LibraryKind>("DESIGN_STYLE");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const add = useMutation({
    mutationFn: () => conceptData.addLibraryEntry(workspaceId, { kind, name, description: desc }),
    onSuccess: () => {
      setName("");
      setDesc("");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => conceptData.removeLibraryEntry(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });
  const entries = query.data ?? [];

  return (
    <SectionCard
      title="AI libraries"
      description="Concept templates, design styles, materials and proposal templates."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {KINDS.map((k) => (
          <div key={k} className="rounded-lg border border-border/60 p-3">
            <p className="text-sm font-medium">{LIBRARY_KIND_LABEL[k]}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {entries.filter((e) => e.kind === k).length === 0 ? (
                <li className="text-xs text-muted-foreground">Empty</li>
              ) : (
                entries
                  .filter((e) => e.kind === k)
                  .map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-2">
                      <span>
                        {e.name}
                        {e.description ? (
                          <span className="block text-xs text-muted-foreground">{e.description}</span>
                        ) : null}
                      </span>
                      {isAdmin ? (
                        <button
                          aria-label={`Remove ${e.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => remove.mutate(e.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </li>
                  ))
              )}
            </ul>
          </div>
        ))}
      </div>
      {isAdmin ? (
        <form
          className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) add.mutate();
          }}
        >
          <SelectField
            label="Library"
            value={kind}
            onValueChange={(v) => setKind(v as LibraryKind)}
            options={KINDS.map((k) => ({ value: k, label: LIBRARY_KIND_LABEL[k] }))}
          />
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button type="submit" disabled={add.isPending || !name.trim()}>
            Add
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Only workshop admins can edit libraries.</p>
      )}
    </SectionCard>
  );
}

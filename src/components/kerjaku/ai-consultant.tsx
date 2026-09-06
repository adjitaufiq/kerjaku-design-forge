import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, MessageCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SelectField, TextAreaField } from "@/components/kerjaku/form-fields";
import { SectionCard } from "@/components/kerjaku/glass-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { analyzeRoom, askConsultant } from "@/lib/ai-consultant.functions";
import { consultantData } from "@/services/ai";
import {
  BRIEF_BUDGETS,
  BRIEF_PURPOSES,
  BRIEF_STYLES,
  CONSULTANT_MODE_LABEL,
  CUSTOMER_PRIORITIES,
  ROOM_TYPES,
  SPACE_CATEGORIES,
  type ConsultantMode,
} from "@/services/domain/consultant";

const options = (values: string[]) => values.map((v) => ({ value: v, label: v }));

/** Design brief + AI analysis + consultant chat for one project. */
export function AiConsultantPanel({
  workspaceId,
  projectId,
  roomImagePath,
  canRun,
}: {
  workspaceId: string | null;
  projectId: string;
  roomImagePath: string | null;
  canRun: boolean;
}) {
  const queryClient = useQueryClient();
  const [spaceCategory, setSpaceCategory] = useState(SPACE_CATEGORIES[0]!);
  const [roomType, setRoomType] = useState(ROOM_TYPES[0]!);
  const [purpose, setPurpose] = useState(BRIEF_PURPOSES[0]!);
  const [budgetRange, setBudgetRange] = useState(BRIEF_BUDGETS[1]!);
  const [preferredStyle, setPreferredStyle] = useState(BRIEF_STYLES[0]!);
  const [customerPriority, setCustomerPriority] = useState(CUSTOMER_PRIORITIES[0]!);
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<ConsultantMode>("CUSTOMER");
  const [question, setQuestion] = useState("");

  const briefQuery = useQuery({
    queryKey: ["design-brief", projectId],
    queryFn: () => consultantData.getBrief(projectId),
    enabled: !!projectId,
  });
  const consultationQuery = useQuery({
    queryKey: ["ai-consultation", projectId],
    queryFn: () => consultantData.getLatestConsultation(projectId),
    enabled: !!projectId,
  });
  const chatQuery = useQuery({
    queryKey: ["ai-chat", projectId, mode],
    queryFn: () => consultantData.listChat(projectId, mode),
    enabled: !!projectId,
  });

  useEffect(() => {
    const b = briefQuery.data;
    if (!b) return;
    if (b.spaceCategory) setSpaceCategory(b.spaceCategory);
    if (b.roomType) setRoomType(b.roomType);
    if (b.purpose) setPurpose(b.purpose);
    if (b.budgetRange) setBudgetRange(b.budgetRange);
    if (b.preferredStyle) setPreferredStyle(b.preferredStyle);
    if (b.customerPriority) setCustomerPriority(b.customerPriority);
    setNotes(b.notes ?? "");
  }, [briefQuery.data]);

  const brief = {
    spaceCategory,
    roomType,
    purpose,
    budgetRange,
    preferredStyle,
    customerPriority,
    notes: notes || null,
  };

  const analyze = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      if (!roomImagePath) throw new Error("Select a concept or upload a room photo first");
      await consultantData.saveBrief(workspaceId, { projectId, ...brief });
      return analyzeRoom({ data: { projectId, imagePath: roomImagePath, brief } });
    },
    onSuccess: async () => {
      toast.success("Room analysis ready");
      await queryClient.invalidateQueries({ queryKey: ["ai-consultation", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["design-brief", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBrief = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("No workspace");
      return consultantData.saveBrief(workspaceId, { projectId, ...brief });
    },
    onSuccess: async () => {
      toast.success("Design brief saved");
      await queryClient.invalidateQueries({ queryKey: ["design-brief", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ask = useMutation({
    mutationFn: async () => askConsultant({ data: { projectId, mode, question } }),
    onSuccess: async () => {
      setQuestion("");
      await queryClient.invalidateQueries({ queryKey: ["ai-chat", projectId, mode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const consultation = consultationQuery.data ?? null;
  const messages = chatQuery.data ?? [];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <SectionCard title="Design brief" description="What the customer actually needs">
        <div className="space-y-4">
          <SelectField
            label="Space category"
            value={spaceCategory}
            onValueChange={setSpaceCategory}
            options={options(SPACE_CATEGORIES)}
          />
          <SelectField
            label="Room type"
            value={roomType}
            onValueChange={setRoomType}
            options={options(ROOM_TYPES)}
          />
          <SelectField
            label="Purpose"
            value={purpose}
            onValueChange={setPurpose}
            options={options(BRIEF_PURPOSES)}
          />
          <SelectField
            label="Budget level"
            value={budgetRange}
            onValueChange={setBudgetRange}
            options={options(BRIEF_BUDGETS)}
          />
          <SelectField
            label="Preferred style"
            value={preferredStyle}
            onValueChange={setPreferredStyle}
            options={options(BRIEF_STYLES)}
          />
          <SelectField
            label="Customer priority"
            value={customerPriority}
            onValueChange={setCustomerPriority}
            options={options(CUSTOMER_PRIORITIES)}
          />
          <TextAreaField
            label="Notes"
            name="brief-notes"
            placeholder="Anything the customer mentioned: family size, storage needs, dislikes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => saveBrief.mutate()}
              disabled={saveBrief.isPending}
            >
              Save brief
            </Button>
            <Button
              className="bg-cta text-cta-foreground hover:bg-cta/90"
              onClick={() => analyze.mutate()}
              disabled={!canRun || analyze.isPending || !roomImagePath}
            >
              <Brain className="size-4" />
              {analyze.isPending ? "Analysing…" : "Analyse room"}
            </Button>
          </div>
          {!roomImagePath ? (
            <p className="text-xs text-muted-foreground">
              Select an existing concept or upload a room photo to enable analysis.
            </p>
          ) : null}
        </div>
      </SectionCard>

      <div className="space-y-5">
        <SectionCard title="AI consultation" description="Room analysis, opportunity, recommendation">
          {consultationQuery.isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : !consultation ? (
            <p className="text-sm text-muted-foreground">
              No analysis yet. Fill the brief and run “Analyse room”.
            </p>
          ) : (
            <div className="space-y-5 text-sm">
              {consultation.roomAnalysis ? (
                <div className="space-y-2">
                  <h3 className="text-xs tracking-wide text-muted-foreground uppercase">
                    Room condition
                  </h3>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["Layout", consultation.roomAnalysis.layout],
                        ["Lighting", consultation.roomAnalysis.lighting],
                        ["Colour", consultation.roomAnalysis.color],
                        ["Furniture", consultation.roomAnalysis.furniture],
                        ["Space use", consultation.roomAnalysis.spaceUtilization],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-border bg-surface/40 p-3">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-1 text-foreground">{value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                  {consultation.roomAnalysis.problems?.length ? (
                    <ul className="list-inside list-disc text-muted-foreground">
                      {consultation.roomAnalysis.problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {consultation.recommendation ? (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                  <h3 className="text-xs tracking-wide text-muted-foreground uppercase">
                    Recommended concept
                  </h3>
                  <p className="mt-1 font-medium text-foreground">
                    {consultation.recommendation.concept}
                  </p>
                  <p className="mt-1 text-muted-foreground">{consultation.recommendation.reason}</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    <li>Colour: {consultation.recommendation.colorDirection}</li>
                    <li>Material: {consultation.recommendation.materialDirection}</li>
                    <li>Furniture: {consultation.recommendation.furnitureDirection}</li>
                    <li>Lighting: {consultation.recommendation.lightingDirection}</li>
                  </ul>
                </div>
              ) : null}

              {consultation.alternatives?.length ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {consultation.alternatives.map((a) => (
                    <div
                      key={a.option}
                      className="rounded-xl border border-border bg-surface/40 p-3"
                    >
                      <p className="text-xs text-muted-foreground">Option {a.option}</p>
                      <p className="font-medium text-foreground">{a.label}</p>
                      <p className="mt-1 text-muted-foreground">{a.concept}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Strengths: {a.strengths}</p>
                      <p className="text-xs text-muted-foreground">Best for: {a.bestFor}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {consultation.salesInsight ? (
                <div className="rounded-xl border border-border bg-surface/40 p-4">
                  <h3 className="text-xs tracking-wide text-muted-foreground uppercase">
                    Sales insight
                  </h3>
                  <p className="mt-1 text-muted-foreground">
                    Need: {consultation.salesInsight.customerNeed}
                  </p>
                  <p className="text-muted-foreground">
                    Motivation: {consultation.salesInsight.buyingMotivation}
                  </p>
                  <p className="text-muted-foreground">
                    Approach: {consultation.salesInsight.salesAngle}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Consultant chat"
          description="Ask in customer, designer or sales mode"
          action={
            <div className="flex gap-1">
              {(Object.keys(CONSULTANT_MODE_LABEL) as ConsultantMode[]).map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={mode === m ? "secondary" : "ghost"}
                  onClick={() => setMode(m)}
                >
                  {CONSULTANT_MODE_LABEL[m]}
                </Button>
              ))}
            </div>
          }
        >
          <div className="space-y-4">
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageCircle className="size-4" /> No conversation yet in this mode.
                </p>
              ) : (
                messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
                        {m.content}
                      </p>
                    </div>
                  ) : (
                    <p key={m.id} className="max-w-[95%] text-sm whitespace-pre-wrap text-foreground">
                      {m.content}
                    </p>
                  ),
                )
              )}
              {ask.isPending ? (
                <p className="animate-pulse text-sm text-muted-foreground">Thinking…</p>
              ) : null}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (question.trim()) ask.mutate();
              }}
            >
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask the consultant…"
                className="min-h-11 bg-surface/60"
                aria-label="Question for the AI consultant"
              />
              <Button type="submit" size="icon" disabled={ask.isPending || !question.trim()}>
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

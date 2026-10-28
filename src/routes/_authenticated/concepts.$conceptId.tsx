import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";

import { useConceptImage } from "@/components/kerjaku/ai-concept-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { conceptData } from "@/services/ai";
import type { DesignConcept } from "@/services/domain/concept";

export const Route = createFileRoute("/_authenticated/concepts/$conceptId")({
  head: () => ({
    meta: [
      { title: "Design Concept Presentation — KERJAKU" },
      {
        name: "description",
        content: "Customer presentation of an AI interior design concept.",
      },
      { property: "og:title", content: "Design Concept Presentation — KERJAKU" },
      { property: "og:description", content: "Customer presentation of an AI interior concept." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PresentationPage,
});

const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? v.join(", ") : "");

function Slide({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-6 md:p-10 print:break-after-page">
      <p className="text-xs uppercase tracking-[0.2em] text-primary">
        {String(n).padStart(2, "0")}
      </p>
      <h2 className="mt-1 font-display text-2xl md:text-3xl">{title}</h2>
      <div className="mt-5 space-y-3 text-sm leading-relaxed md:text-base">{children}</div>
    </section>
  );
}

function PresentationPage() {
  const { conceptId } = Route.useParams();
  const q = useQuery({
    queryKey: ["ai-concepts", conceptId],
    queryFn: () => conceptData.get(conceptId),
  });
  const c = q.data;
  const image = useConceptImage(c?.imageUrl ?? null);

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (!c) return <p>Concept not found.</p>;
  return <Deck c={c} image={image} />;
}

function Deck({ c, image }: { c: DesignConcept; image: string | null }) {
  const ra = c.roomAnalysis ?? {};
  const op = c.opportunity ?? {};
  const tiers = (["premium", "standard", "budget"] as const)
    .map((k) => c.materials[k])
    .filter(Boolean);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" asChild>
          <Link to="/ai-interior">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print / PDF
        </Button>
      </div>
      <header className="py-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Design concept</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl">{c.name}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{c.philosophy}</p>
      </header>
      <Slide n={1} title="Customer problem">
        <ul className="list-disc pl-5">
          {(Array.isArray(ra["visualProblems"]) ? (ra["visualProblems"] as string[]) : []).map(
            (p, i) => (
              <li key={i}>{p}</li>
            ),
          )}
        </ul>
        {str(op["improvementArea"]) ? <p>{str(op["improvementArea"])}</p> : null}
      </Slide>
      <Slide n={2} title="Existing condition">
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ["Room", ra["roomType"]],
            ["Size", ra["size"]],
            ["Layout", ra["layout"]],
            ["Lighting", ra["lighting"]],
            ["Existing furniture", ra["existingFurniture"]],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className="text-xs uppercase text-muted-foreground">{String(k)}</dt>
              <dd>{str(v) || "—"}</dd>
            </div>
          ))}
        </dl>
      </Slide>
      <Slide n={3} title="Design concept">
        <p>
          <strong>Style:</strong> {c.style}
        </p>
        <p>
          <strong>Colour palette:</strong> {c.colorPalette}
        </p>
        <p>
          <strong>Why it fits:</strong> {c.reason}
        </p>
      </Slide>
      <Slide n={4} title="AI visualisation">
        {image ? (
          <img src={image} alt={c.name} className="w-full rounded-xl object-cover" />
        ) : (
          <p className="text-muted-foreground">No visualisation attached.</p>
        )}
      </Slide>
      <Slide n={5} title="Recommended solution">
        <p>
          <strong>Furniture:</strong> {c.furnitureRecommendation}
        </p>
        <p>
          <strong>Lighting:</strong> {c.lightingRecommendation}
        </p>
        <p>{str(op["functionalImprovement"])}</p>
        <p>{str(op["aestheticImprovement"])}</p>
        {c.scopeOfWork.length ? (
          <ol className="list-decimal pl-5">
            {c.scopeOfWork.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        ) : null}
      </Slide>
      <Slide n={6} title="Material direction">
        <p>{c.materialDirection}</p>
        <div className="grid gap-3 md:grid-cols-3">
          {tiers.map((t) => (
            <div key={t!.label} className="rounded-lg border border-border/60 p-3 text-sm">
              <p className="font-medium">{t!.label}</p>
              <p className="text-xs text-muted-foreground">{t!.summary}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {t!.items.map((i, idx) => (
                  <li key={idx}>
                    {i.area}: {i.material} · {i.finishing}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Slide>
      <Slide n={7} title="Next step">
        <p>{c.nextAction}</p>
        {c.timelineEstimate ? (
          <p>
            <strong>Estimated timeline:</strong> {c.timelineEstimate}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Final pricing will be confirmed in the proposal.
        </p>
      </Slide>
    </div>
  );
}

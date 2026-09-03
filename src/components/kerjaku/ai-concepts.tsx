import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { aiData } from "@/services/ai";
import { formatDate } from "@/services/domain/models";

/** Approved AI interior concepts for a set of projects. */
export function ApprovedConcepts({
  workspaceId,
  projectIds,
}: {
  workspaceId: string | null;
  projectIds: string[];
}) {
  const enabled = !!workspaceId && projectIds.length > 0;

  const conceptsQuery = useQuery({
    queryKey: ["ai-approved", workspaceId, projectIds],
    enabled,
    queryFn: async () => {
      const all = await aiData.listGenerations(workspaceId!);
      const approved = all.filter(
        (g) => g.approved && g.projectId && projectIds.includes(g.projectId) && g.outputImageUrl,
      );
      return Promise.all(
        approved.map(async (g) => ({
          id: g.id,
          version: g.version,
          createdAt: g.createdAt,
          style: g.style,
          url: await aiData.getImageUrl(g.outputImageUrl!),
        })),
      );
    },
  });

  if (!enabled) return null;

  const concepts = conceptsQuery.data ?? [];

  return (
    <div>
      {conceptsQuery.isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : concepts.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">No approved AI concept yet.</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/ai-interior">
              <Sparkles className="size-4" /> Open AI Interior
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {concepts.map((c) => (
            <figure
              key={c.id}
              className="overflow-hidden rounded-xl border border-border bg-surface/40"
            >
              {c.url ? (
                <img
                  src={c.url}
                  alt={`Approved AI interior concept version ${c.version}`}
                  loading="lazy"
                  className="aspect-4/3 w-full object-cover"
                />
              ) : null}
              <figcaption className="px-3 py-2 text-xs text-muted-foreground">
                v{c.version} · {c.style ?? "—"} · {formatDate(c.createdAt)}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

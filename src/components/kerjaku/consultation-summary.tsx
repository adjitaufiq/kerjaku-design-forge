import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { consultantData } from "@/services/ai";
import { formatDate } from "@/services/domain/models";

/** Latest AI consultation recommendation for the first linked project. */
export function ConsultationSummary({ projectId }: { projectId: string | null }) {
  const query = useQuery({
    queryKey: ["ai-consultation", projectId],
    queryFn: () => consultantData.getLatestConsultation(projectId!),
    enabled: !!projectId,
  });

  if (!projectId) return <p className="text-sm text-muted-foreground">No linked project yet.</p>;
  if (query.isLoading) return <Skeleton className="h-24 rounded-xl" />;

  const c = query.data;
  if (!c?.recommendation)
    return (
      <p className="text-sm text-muted-foreground">
        No AI consultation yet for this client&apos;s project.
      </p>
    );

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium text-foreground">{c.recommendation.concept}</p>
      <p className="text-muted-foreground">{c.recommendation.reason}</p>
      {c.salesInsight ? (
        <p className="text-muted-foreground">Sales angle: {c.salesInsight.salesAngle}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">Analysed {formatDate(c.createdAt)}</p>
    </div>
  );
}

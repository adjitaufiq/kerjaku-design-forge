import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban, HandCoins, Target, Users } from "lucide-react";

import { GlassCard } from "@/components/kerjaku/glass-card";
import { KanbanBoard, KanbanCard, KanbanColumn } from "@/components/kerjaku/kanban";
import { PageHeader } from "@/components/kerjaku/page-header";
import { StatCard } from "@/components/kerjaku/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { data } from "@/services/data";
import { formatIDR, LEAD_STAGES, LEAD_STATUS_LABEL } from "@/services/domain/models";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — KERJAKU Interior Studio" },
      {
        name: "description",
        content: "Track leads, active interior projects and pipeline value at a glance.",
      },
      { property: "og:title", content: "Dashboard — KERJAKU Interior Studio" },
      {
        property: "og:description",
        content: "Your workshop's pipeline, leads and project value in one view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { workspaceId } = useWorkspace();

  const leadsQuery = useQuery({
    queryKey: ["leads", workspaceId],
    queryFn: () => data.leads.list(workspaceId!),
    enabled: !!workspaceId,
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => data.projects.list(workspaceId!),
    enabled: !!workspaceId,
  });

  const leads = leadsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const loading = leadsQuery.isLoading || projectsQuery.isLoading || !workspaceId;

  const activeLeads = leads.filter((l) => l.status !== "COMPLETED").length;
  const deals = leads.filter((l) => l.status === "DEAL" || l.status === "COMPLETED").length;
  const pipelineValue = projects
    .filter((p) => p.status !== "COMPLETED")
    .reduce((sum, p) => sum + p.estimatedValue, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your workshop pipeline at a glance"
        actions={
          <Button asChild className="bg-cta text-cta-foreground hover:bg-cta/90">
            <Link to="/leads">Manage leads</Link>
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active leads" value={activeLeads} icon={Users} />
          <StatCard label="Projects" value={projects.length} icon={FolderKanban} />
          <StatCard label="Deals won" value={deals} icon={Target} />
          <StatCard
            label="Pipeline value"
            value={formatIDR(pipelineValue)}
            icon={HandCoins}
            hint="Open projects"
          />
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
          Sales pipeline
        </h2>
        {loading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : leads.length === 0 ? (
          <GlassCard className="text-center text-sm text-muted-foreground">
            No leads yet. Add your first client to start the pipeline.
          </GlassCard>
        ) : (
          <KanbanBoard>
            {LEAD_STAGES.map((stage) => {
              const stageLeads = leads.filter((l) => l.status === stage);
              return (
                <KanbanColumn
                  key={stage}
                  title={LEAD_STATUS_LABEL[stage]}
                  count={stageLeads.length}
                >
                  {stageLeads.map((lead) => (
                    <Link key={lead.id} to="/leads/$leadId" params={{ leadId: lead.id }}>
                      <KanbanCard>
                        <p className="font-medium text-foreground">{lead.clientName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {lead.location ?? lead.phone ?? "—"}
                        </p>
                      </KanbanCard>
                    </Link>
                  ))}
                </KanbanColumn>
              );
            })}
          </KanbanBoard>
        )}
      </div>
    </>
  );
}

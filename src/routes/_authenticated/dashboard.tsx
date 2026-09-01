import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardList,
  FolderKanban,
  HandCoins,
  Sparkles,
  Target,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";

import { EmptyStateCard } from "@/components/kerjaku/empty-state";
import { SectionCard } from "@/components/kerjaku/glass-card";
import { KanbanBoard, KanbanCard, KanbanColumn } from "@/components/kerjaku/kanban";
import { PageHeader } from "@/components/kerjaku/page-header";
import { StatCard } from "@/components/kerjaku/stat-card";
import { StatusBadge } from "@/components/kerjaku/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { data } from "@/services/data";
import { demoLeads, demoProjects, isDemoAvailable } from "@/services/demo/demo-data";
import { formatDate, formatIDR, LEAD_STAGES, LEAD_STATUS_LABEL } from "@/services/domain/models";


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

  const [demoMode, setDemoMode] = useState(false);
  const useDemo = isDemoAvailable && demoMode;

  const realLeads = leadsQuery.data ?? [];
  const realProjects = projectsQuery.data ?? [];
  const leads = useDemo ? demoLeads : realLeads;
  const projects = useDemo ? demoProjects : realProjects;
  const loading = !useDemo && (leadsQuery.isLoading || projectsQuery.isLoading || !workspaceId);
  const isEmpty = !loading && leads.length === 0 && projects.length === 0;

  const activeLeads = leads.filter((l) => l.status !== "COMPLETED").length;
  const deals = leads.filter((l) => l.status === "DEAL" || l.status === "COMPLETED").length;
  const pipelineValue = projects
    .filter((p) => p.status !== "COMPLETED")
    .reduce((sum, p) => sum + p.estimatedValue, 0);

  const followUps = leads
    .filter((l) => !!l.nextFollowUp && l.status !== "COMPLETED")
    .sort((a, b) => (a.nextFollowUp! < b.nextFollowUp! ? -1 : 1))
    .slice(0, 6);

  const recentActivity = [
    ...leads.map((l) => ({
      id: `lead-${l.id}`,
      at: l.updatedAt ?? l.createdAt,
      title: l.clientName,
      detail: `Lead · ${LEAD_STATUS_LABEL[l.status]}`,
      to: { to: "/leads/$leadId" as const, params: { leadId: l.id } },
    })),
    ...projects.map((p) => ({
      id: `project-${p.id}`,
      at: p.createdAt,
      title: p.projectName,
      detail: `Project · ${formatIDR(p.estimatedValue)}`,
      to: { to: "/projects" as const, params: {} },
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your workshop pipeline at a glance"
        actions={
          <div className="flex flex-wrap gap-2">
            {isDemoAvailable ? (
              <Button variant="outline" onClick={() => setDemoMode((v) => !v)}>
                {demoMode ? "Exit sample data" : "Preview sample data"}
              </Button>
            ) : null}
            <Button asChild className="bg-cta text-cta-foreground hover:bg-cta/90">
              <Link to="/leads">Manage leads</Link>
            </Button>
          </div>
        }
      />

      {useDemo ? (
        <div className="mb-4">
          <StatusBadge tone="info">
            Preview mode — sample data, nothing is saved to your workspace
          </StatusBadge>
        </div>
      ) : null}


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

      {!loading && followUps.length > 0 ? (
        <div className="mt-8">
          <SectionCard
            title="Follow up reminders"
            description="Clients waiting for your next touchpoint."
          >
            <ul className="space-y-2">
              {followUps.map((lead) => {
                const due = new Date(lead.nextFollowUp!) <= new Date();
                return (
                  <li key={lead.id}>
                    <Link
                      to="/leads/$leadId"
                      params={{ leadId: lead.id }}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3 transition-colors hover:bg-surface/70"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{lead.clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {LEAD_STATUS_LABEL[lead.status]} · {formatDate(lead.nextFollowUp)}
                        </p>
                      </div>
                      <StatusBadge tone={due ? "warning" : "info"}>
                        {due ? "Due now" : "Upcoming"}
                      </StatusBadge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
          Sales pipeline
        </h2>
        {loading ? (
          <Skeleton className="h-48 rounded-2xl" />
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

      <div className="mt-8">
        <SectionCard title="Recent activity" description="Latest movement across your workshop.">
          {loading ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity yet. Your leads, consultations and projects will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((item) => (
                <li key={item.id}>
                  <Link
                    {...item.to}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3 transition-colors hover:bg-surface/70"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(item.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {isEmpty ? (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
            Get started
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <EmptyStateCard
              icon={UserPlus}
              title="No leads yet"
              description="Start your first client consultation."
              actionLabel="Create Lead"
              to="/leads"
            />
            <EmptyStateCard
              icon={ClipboardList}
              title="Create first consultation"
              description="Capture the client brief, budget and style preference."
              actionLabel="Go to Consultation"
              to="/consultation"
            />
            <EmptyStateCard
              icon={Sparkles}
              title="Generate first AI concept"
              description="This feature is coming soon."
              actionLabel="Coming soon"
              disabled
              badge={<StatusBadge tone="info">Soon</StatusBadge>}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

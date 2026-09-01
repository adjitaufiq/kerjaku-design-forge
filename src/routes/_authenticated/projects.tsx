import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { DataTable, type Column } from "@/components/kerjaku/data-table";
import { PageHeader } from "@/components/kerjaku/page-header";
import { ProjectStatusBadge } from "@/components/kerjaku/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { data } from "@/services/data";
import { formatDate, formatIDR, PROJECT_TYPE_LABEL, type Project } from "@/services/domain/models";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects — KERJAKU Interior Studio" },
      {
        name: "description",
        content:
          "Every interior project with status, client, estimated value and creation date in one workshop view.",
      },
      { property: "og:title", content: "Projects — KERJAKU Interior Studio" },
      {
        property: "og:description",
        content: "Track kitchen sets, wardrobes and interiors from draft to production.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate();

  const projectsQuery = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => data.projects.list(workspaceId!),
    enabled: !!workspaceId,
  });
  const leadsQuery = useQuery({
    queryKey: ["leads", workspaceId],
    queryFn: () => data.leads.list(workspaceId!),
    enabled: !!workspaceId,
  });

  const leadName = new Map((leadsQuery.data ?? []).map((l) => [l.id, l.clientName]));

  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Project",
      render: (p) => (
        <div>
          <p className="font-medium">{p.projectName}</p>
          <p className="text-xs text-muted-foreground">{PROJECT_TYPE_LABEL[p.projectType]}</p>
        </div>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (p) => (p.leadId ? (leadName.get(p.leadId) ?? "—") : "—"),
    },
    { key: "status", header: "Status", render: (p) => <ProjectStatusBadge status={p.status} /> },
    { key: "value", header: "Value", render: (p) => formatIDR(p.estimatedValue) },
    { key: "created", header: "Created", render: (p) => formatDate(p.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="All interior jobs across your workshop"
        actions={
          <Button asChild className="bg-cta text-cta-foreground hover:bg-cta/90">
            <Link to="/consultation">
              <Plus className="size-4" /> New project
            </Link>
          </Button>
        }
      />

      {projectsQuery.isLoading || !workspaceId ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <DataTable
          columns={columns}
          rows={projectsQuery.data ?? []}
          getRowId={(p) => p.id}
          onRowClick={(p) =>
            p.leadId ? navigate({ to: "/leads/$leadId", params: { leadId: p.leadId } }) : undefined
          }
          emptyMessage="No projects yet. Start one from a consultation."
        />
      )}
    </>
  );
}

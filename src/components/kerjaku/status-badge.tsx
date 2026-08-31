import { cn } from "@/lib/utils";
import {
  LEAD_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  type LeadStatus,
  type ProjectStatus,
} from "@/services/domain/models";

const TONES = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info/15 text-info border-info/30",
  primary: "bg-primary/15 text-primary-glow border-primary/40",
  cta: "bg-cta/15 text-cta border-cta/40",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
} as const;

export type BadgeTone = keyof typeof TONES;

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const LEAD_TONES: Record<LeadStatus, BadgeTone> = {
  NEW: "neutral",
  CONSULTATION: "info",
  AI_CONCEPT: "primary",
  PROPOSAL: "cta",
  NEGOTIATION: "warning",
  DEAL: "success",
  PRODUCTION: "info",
  COMPLETED: "success",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <StatusBadge tone={LEAD_TONES[status]}>{LEAD_STATUS_LABEL[status]}</StatusBadge>;
}

const PROJECT_TONES: Record<ProjectStatus, BadgeTone> = {
  DRAFT: "neutral",
  DESIGN: "info",
  PROPOSAL: "cta",
  PRODUCTION: "warning",
  COMPLETED: "success",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <StatusBadge tone={PROJECT_TONES[status]}>{PROJECT_STATUS_LABEL[status]}</StatusBadge>;
}

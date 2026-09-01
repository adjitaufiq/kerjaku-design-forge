import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { GlassCard } from "./glass-card";

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  to,
  disabled = false,
  badge,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  to?: string;
  disabled?: boolean;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("flex h-full flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-accent">
          <Icon className="size-5" />
        </span>
        {badge}
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {disabled || !to ? (
        <Button variant="outline" size="sm" disabled className="w-full">
          {actionLabel}
        </Button>
      ) : (
        <Button asChild size="sm" className="w-full bg-cta text-cta-foreground hover:bg-cta/90">
          <Link to={to}>{actionLabel}</Link>
        </Button>
      )}
    </GlassCard>
  );
}

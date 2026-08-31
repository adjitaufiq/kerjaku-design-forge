import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function KanbanBoard({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {children}
    </div>
  );
}

export function KanbanColumn({
  title,
  count,
  children,
  className,
}: {
  title: string;
  count: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-64 shrink-0 flex-col gap-3", className)}>
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface/50 px-3 py-2">
        <span className="text-xs font-semibold tracking-wider text-foreground uppercase">
          {title}
        </span>
        <span className="rounded-full bg-primary/20 px-2 text-xs text-primary-glow">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function KanbanCard({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "glass-panel rounded-xl p-3 text-sm transition-all",
        onClick && "cursor-pointer hover:glow-ring",
        className,
      )}
    >
      {children}
    </div>
  );
}

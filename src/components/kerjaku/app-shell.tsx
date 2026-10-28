import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/quick-visual", label: "Quick Visual", icon: Sparkles },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/consultation", label: "Consultation", icon: ClipboardList },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/ai-interior", label: "AI Interior", icon: Wand2 },
  { to: "/proposals", label: "Proposals", icon: FileText },
  { to: "/settings", label: "Workshop Settings", icon: Building2 },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || pathname.startsWith(`${to}/`);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-primary/20 text-foreground glow-ring"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-primary/20 text-accent">
        <Sparkles className="size-5" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-widest text-foreground">KERJAKU</p>
        <p className="text-[11px] text-muted-foreground">Interior Studio</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { role } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 px-4 py-6 backdrop-blur-xl lg:flex">
        <BrandMark />
        <div className="mt-8 flex-1">
          <NavLinks />
        </div>
        <div className="rounded-xl border border-border bg-surface/50 p-3">
          <p className="truncate text-sm font-medium text-foreground">{user?.name ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {role ? role.replace("_", " ") : user?.email}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start px-2 text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:hidden">
          <BrandMark />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl bg-sidebar px-4 pb-8">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="pt-4">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
                <Button
                  variant="ghost"
                  className="mt-3 w-full justify-start px-3 text-muted-foreground"
                  onClick={handleSignOut}
                >
                  <LogOut className="size-4" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

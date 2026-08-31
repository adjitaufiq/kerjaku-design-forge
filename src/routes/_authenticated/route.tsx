import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/kerjaku/app-shell";
import { authService } from "@/services/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await authService.getCurrentUser();
    if (!user) throw redirect({ to: "/auth", search: { mode: "signin" } });
    return { user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

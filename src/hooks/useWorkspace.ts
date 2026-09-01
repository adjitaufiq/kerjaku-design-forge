import { useQuery } from "@tanstack/react-query";

import { ensureWorkspace } from "@/lib/workspace.functions";
import { data } from "@/services/data";
import type { Membership } from "@/services/domain/models";

/** Current user's workspace membership (workspace id + role). */
export function useWorkspace() {
  const query = useQuery({
    queryKey: ["membership"],
    queryFn: async (): Promise<Membership | null> => {
      const membership = await data.workspaces.getMembership();
      if (membership) return membership;
      // Older accounts may have no workspace row yet — provision one.
      const created = await ensureWorkspace();
      return created as Membership;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    workspaceId: query.data?.workspaceId ?? null,
    role: query.data?.role ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

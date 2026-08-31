import { useQuery } from "@tanstack/react-query";

import { data } from "@/services/data";

/** Current user's workspace membership (workspace id + role). */
export function useWorkspace() {
  const query = useQuery({
    queryKey: ["membership"],
    queryFn: () => data.workspaces.getMembership(),
    staleTime: 5 * 60 * 1000,
  });

  return {
    workspaceId: query.data?.workspaceId ?? null,
    role: query.data?.role ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

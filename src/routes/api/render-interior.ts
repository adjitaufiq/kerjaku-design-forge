import { createFileRoute } from "@tanstack/react-router";
import { renderInterior } from "@/lib/interior-gateway.server";

export const Route = createFileRoute("/api/render-interior")({
  server: { handlers: { POST: ({ request }) => renderInterior(request) } },
});
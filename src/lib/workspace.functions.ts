import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the caller's workspace membership, provisioning a workspace when the
 * account was created before the signup trigger existed.
 */
export const ensureWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing, error } = await context.supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (existing) {
      return { workspaceId: existing.workspace_id, role: existing.role };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = (context.claims as { email?: string } | null)?.email ?? "";
    const name = email ? email.split("@")[0]! : "My";
    const workshopName = `${name} Interior`;

    const { data: ws, error: wsError } = await supabaseAdmin
      .from("workspaces")
      .insert({ name: workshopName })
      .select("id")
      .single();
    if (wsError || !ws) throw new Error(wsError?.message ?? "Could not create workspace");

    const { error: memberError } = await supabaseAdmin
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: context.userId, role: "admin_workshop" });
    if (memberError) throw new Error(memberError.message);

    await supabaseAdmin.from("workshops").insert({
      workspace_id: ws.id,
      name: workshopName,
      email,
    });
    await supabaseAdmin.from("ai_credits").insert({ workspace_id: ws.id });

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: context.userId, name, email }, { onConflict: "id" });

    return { workspaceId: ws.id, role: "admin_workshop" as const };
  });

import { supabase } from "@/integrations/supabase/client";
import type { AuthEvent, AuthService, AuthUser } from "./auth-service";

type CloudUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function toAuthUser(user: CloudUser | null | undefined): AuthUser | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  const name =
    (meta["name"] as string | undefined) ??
    (meta["full_name"] as string | undefined) ??
    (user.email ? (user.email.split("@")[0] ?? "User") : "User");
  return {
    id: user.id,
    email: user.email ?? "",
    name,
    avatarUrl: (meta["avatar_url"] as string | undefined) ?? null,
  };
}

function mapEvent(event: string): AuthEvent {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") return event;
  return "OTHER";
}

/** Lovable Cloud implementation of the AuthService contract. */
export const cloudAuthService: AuthService = {
  async getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    return toAuthUser(data.user);
  },

  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const user = toAuthUser(data.user);
    if (!user) throw new Error("Sign in failed. Please try again.");
    return user;
  },

  async signUp({ email, password, name, workshopName }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { name, workshop_name: workshopName },
      },
    });
    if (error) throw new Error(error.message);
    return toAuthUser(data.user);
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  onAuthStateChange(listener) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      listener(mapEvent(event), toAuthUser(session?.user));
    });
    return () => data.subscription.unsubscribe();
  },
};

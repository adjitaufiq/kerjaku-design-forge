import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { GlassCard } from "@/components/kerjaku/glass-card";
import { TextField } from "@/components/kerjaku/form-fields";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

type Search = { mode?: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    mode: search["mode"] === "signup" ? "signup" : "signin",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — KERJAKU Interior Studio" },
      {
        name: "description",
        content: "Sign in or create your KERJAKU workshop account to manage interior sales.",
      },
      { property: "og:title", content: "Sign in — KERJAKU Interior Studio" },
      {
        property: "og:description",
        content: "Access your interior workshop's AI sales workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading, signIn, signUp } = useAuth();
  const isSignUp = mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignUp) {
        const created = await signUp({ email, password, name, workshopName });
        if (created) {
          toast.success("Workshop created. Welcome to KERJAKU.");
          navigate({ to: "/dashboard", replace: true });
        } else {
          toast.success("Check your email to confirm your account.");
        }
      } else {
        await signIn({ email, password });
        toast.success("Welcome back.");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <GlassCard className="w-full max-w-md" glow>
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/20 text-accent">
            <Sparkles className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-widest text-foreground">KERJAKU</p>
            <p className="text-xs text-muted-foreground">Interior Studio</p>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-foreground">
          {isSignUp ? "Create your workshop" : "Sign in to your workspace"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSignUp
            ? "You'll become the workshop admin for your team."
            : "Use your email and password to continue."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {isSignUp ? (
            <>
              <TextField
                label="Your name"
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adji Taufik"
              />
              <TextField
                label="Workshop name"
                name="workshopName"
                required
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                placeholder="KERJAKU Interior"
              />
            </>
          ) : null}
          <TextField
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@workshop.com"
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
          >
            {busy ? "Please wait…" : isSignUp ? "Create workshop" : "Sign in"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-5 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() =>
            navigate({ to: "/auth", search: { mode: isSignUp ? "signin" : "signup" } })
          }
        >
          {isSignUp ? "Already have an account? Sign in" : "New workshop? Create an account"}
        </button>
      </GlassCard>
    </div>
  );
}

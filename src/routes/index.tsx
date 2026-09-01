import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, LineChart, Palette, Sparkles } from "lucide-react";

import { GlassCard } from "@/components/kerjaku/glass-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KERJAKU Interior Studio — AI Sales OS for Interior Workshops" },
      {
        name: "description",
        content:
          "Turn client inquiries into signed interior projects: consultation, AI visual concepts, proposals and follow-up in one workspace.",
      },
      { property: "og:title", content: "KERJAKU Interior Studio" },
      {
        property: "og:description",
        content:
          "The AI sales operating system for interior workshops — leads, consultations, concepts and proposals in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Palette,
    title: "Consultation",
    body: "Capture every client brief with photos and references.",
  },
  { icon: Bot, title: "AI concepts", body: "Turn a room photo into a realistic design direction." },
  { icon: LineChart, title: "Pipeline", body: "Follow each lead from inquiry to signed deal." },
];

function Landing() {
  return (
    <div className="min-h-screen px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-accent" /> KERJAKU Interior Studio
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Build beautiful spaces <span className="gradient-text">faster with AI</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          The sales operating system for interior workshops. Consultation, visual concepts,
          proposals and follow-up — all in one dark, focused workspace.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="bg-cta text-cta-foreground hover:bg-cta/90">
            <Link to="/auth">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth" search={{ mode: "signin" }}>
              Sign in
            </Link>
          </Button>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <GlassCard key={title} className="text-left">
              <Icon className="size-5 text-accent" />
              <h2 className="mt-3 text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}

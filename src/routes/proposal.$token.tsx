import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
  getPublicProposal,
  getPublicProposalItems,
} from "@/lib/public-proposal.functions";
import { formatDate, formatIDR, PROJECT_TYPE_LABEL } from "@/services/domain/models";
import type { ProjectType } from "@/services/domain/models";

export const Route = createFileRoute("/proposal/$token")({
  head: () => ({
    meta: [
      { title: "Your interior proposal — KERJAKU" },
      {
        name: "description",
        content:
          "View your personalised interior design proposal: concept, scope of work, materials and pricing.",
      },
      { property: "og:title", content: "Your interior proposal — KERJAKU" },
      {
        property: "og:description",
        content: "Concept, scope, materials and pricing for your interior project.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicProposalPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-8">
      <h2 className="mb-3 text-sm font-semibold tracking-widest text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PublicProposalPage() {
  const { token } = Route.useParams();

  const proposalQuery = useQuery({
    queryKey: ["public-proposal", token],
    queryFn: () => getPublicProposal({ data: { token } }),
  });
  const itemsQuery = useQuery({
    queryKey: ["public-proposal-items", token],
    queryFn: () => getPublicProposalItems({ data: { token } }),
  });

  if (proposalQuery.isLoading) {
    return <div className="p-10 text-center text-muted-foreground">Loading proposal…</div>;
  }

  const proposal = proposalQuery.data;
  if (!proposal) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Proposal not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link is invalid or has been withdrawn. Please contact your interior consultant.
        </p>
      </main>
    );
  }

  const items = itemsQuery.data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {proposal.workshop?.logoUrl ? (
            <img
              src={proposal.workshop.logoUrl}
              alt={`${proposal.workshop.name} logo`}
              className="size-12 rounded-xl object-cover"
              loading="lazy"
            />
          ) : null}
          <div>
            <p className="text-sm font-semibold tracking-widest text-foreground uppercase">
              {proposal.workshop?.name ?? "KERJAKU Interior"}
            </p>
            <p className="text-xs text-muted-foreground">
              {[proposal.workshop?.city, proposal.workshop?.phone].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(proposal.createdAt)}</p>
      </header>

      <h1 className="mt-10 text-3xl font-semibold tracking-tight text-foreground">
        {proposal.title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Prepared for {proposal.clientName ?? "you"} · {proposal.projectName} ·{" "}
        {PROJECT_TYPE_LABEL[proposal.projectType as ProjectType] ?? proposal.projectType}
      </p>

      {proposal.images.length > 0 ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {proposal.images.map((src) => (
            <img
              key={src}
              src={src}
              alt={`${proposal.projectName} design reference`}
              className="aspect-4/3 w-full rounded-2xl object-cover"
              loading="lazy"
            />
          ))}
        </div>
      ) : null}

      <div className="mt-8">
        <Section title="Design concept">
          <p className="text-sm whitespace-pre-line text-foreground">
            {proposal.conceptNote ?? "—"}
          </p>
        </Section>
        <Section title="Scope of work">
          <p className="text-sm whitespace-pre-line text-foreground">
            {proposal.scopeOfWork ?? "—"}
          </p>
        </Section>
        <Section title="Material specification">
          <p className="text-sm whitespace-pre-line text-foreground">
            {proposal.materialSpec ?? "—"}
          </p>
        </Section>
        <Section title="Bill of quantity">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="bg-surface/60 text-xs tracking-wider text-muted-foreground uppercase">
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.position} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground">{item.description}</td>
                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">{formatIDR(item.price)}</td>
                    <td className="px-4 py-3 text-right">{formatIDR(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-cta/40 bg-cta/10 px-4 py-3">
            <span className="text-sm font-medium text-foreground">Total investment</span>
            <span className="text-lg font-semibold text-cta">
              {formatIDR(proposal.totalAmount)}
            </span>
          </div>
        </Section>
        <Section title="Terms & agreement">
          <p className="text-sm whitespace-pre-line text-foreground">{proposal.terms ?? "—"}</p>
        </Section>
      </div>

      {proposal.pdfUrl ? (
        <a
          href={proposal.pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-xl bg-cta px-5 py-3 text-sm font-medium text-cta-foreground"
        >
          Download PDF
        </a>
      ) : null}

      <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
        {[
          proposal.workshop?.name,
          proposal.workshop?.phone,
          proposal.workshop?.email,
          proposal.workshop?.address,
        ]
          .filter(Boolean)
          .join(" · ")}
      </footer>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  approveAndPushDraft,
  importLeadsFromCsv,
  regenerateDraftForLead,
  rejectLead,
  runDiscovery,
  runEnrichment,
  runPersonalization,
  updateDraft,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      leads: {
        orderBy: [{ fitScore: "desc" }, { createdAt: "asc" }],
        include: { drafts: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });

  if (!campaign) notFound();

  const counts = campaign.leads.reduce(
    (acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/campaigns" className="text-xs text-zinc-500 hover:underline">
        ← all campaigns
      </Link>
      <header className="mt-2 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {campaign.niche} · {campaign.location} · status: {campaign.status}
        </p>
        <details className="mt-3 text-xs text-zinc-500">
          <summary className="cursor-pointer">Pitch</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-zinc-50 p-3 dark:bg-zinc-900">
            {campaign.pitch}
          </pre>
        </details>
      </header>

      <details className="mb-4 rounded border border-zinc-200 bg-white p-4 text-xs dark:border-zinc-800 dark:bg-zinc-950">
        <summary className="cursor-pointer font-medium">
          Import leads from CSV (alternative to discovery)
        </summary>
        <form
          action={async (fd: FormData) => {
            "use server";
            await importLeadsFromCsv(campaign.id, fd);
          }}
          className="mt-3 space-y-2"
        >
          <p className="text-zinc-500">
            Header row required. Recognized columns:{" "}
            <code>name, website, email, phone, address, category</code>. Rows with
            an email skip enrichment and go straight to drafting.
          </p>
          <textarea
            name="csv"
            rows={6}
            placeholder={`name,website,email\nAcme Plumbing,https://acme.example,info@acme.example`}
            className="w-full rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
            Import CSV
          </button>
        </form>
      </details>

      <section className="mb-6 flex flex-wrap gap-3">
        <form action={runDiscovery.bind(null, campaign.id)}>
          <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
            1. Discover leads
          </button>
        </form>
        <form action={runEnrichment.bind(null, campaign.id)}>
          <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
            2. Enrich
          </button>
        </form>
        <form action={runPersonalization.bind(null, campaign.id)}>
          <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
            3. Generate drafts
          </button>
        </form>
        <div className="ml-auto text-xs text-zinc-500">
          {Object.entries(counts).map(([k, v]) => (
            <span key={k} className="mr-3">
              {k}: <strong>{v}</strong>
            </span>
          ))}
        </div>
      </section>

      <ul className="space-y-3">
        {campaign.leads.length === 0 && (
          <li className="rounded border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No leads yet — run discovery.
          </li>
        )}
        {campaign.leads.map((lead) => {
          const draft = lead.drafts[0];
          const enriched = lead.enriched ? safeParse(lead.enriched) : null;
          return (
            <li
              key={lead.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{lead.businessName}</h3>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {lead.status}
                    </span>
                    {lead.fitScore != null && (
                      <span className="text-xs text-zinc-500">
                        fit {lead.fitScore}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {lead.website && (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {lead.website}
                      </a>
                    )}
                    {lead.primaryEmail && <span> · {lead.primaryEmail}</span>}
                    {lead.phone && <span> · {lead.phone}</span>}
                  </div>
                  {enriched?.signals?.length > 0 && (
                    <div className="mt-1 text-xs text-zinc-500">
                      signals: {enriched.signals.join(", ")}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {draft && lead.status !== "handed_off" && (
                    <form action={approveAndPushDraft.bind(null, draft.id)}>
                      <button className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                        Push to tracker
                      </button>
                    </form>
                  )}
                  {lead.status === "drafted" && (
                    <form action={regenerateDraftForLead.bind(null, lead.id)}>
                      <button className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                        Regenerate
                      </button>
                    </form>
                  )}
                  {lead.status !== "rejected" && lead.status !== "handed_off" && (
                    <form action={rejectLead.bind(null, lead.id)}>
                      <button className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                        Reject
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {draft && (
                <form
                  action={updateDraft.bind(null, draft.id)}
                  className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800"
                >
                  <input
                    name="subject"
                    defaultValue={draft.subject ?? ""}
                    className="w-full rounded border border-zinc-200 px-2 py-1 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900"
                  />
                  <textarea
                    name="body"
                    defaultValue={draft.body}
                    rows={5}
                    className="w-full rounded border border-zinc-200 px-2 py-1 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  />
                  <button className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                    Save edits
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

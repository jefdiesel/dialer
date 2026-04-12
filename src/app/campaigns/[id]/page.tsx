import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  approveAndPushDraft,
  detectRepliesAction,
  importLeadsFromCsv,
  markRepliedAction,
  regenerateDraftForLead,
  rejectLead,
  runDiscovery,
  runDueFollowUpsAction,
  runEnrichment,
  runPersonalization,
  scrapeIndeedForCampaign,
  updateDraft,
} from "../actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  enriched: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  drafted: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  handed_off: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  replied: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  rejected: "bg-zinc-50 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600",
  failed: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
};

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
  const total = campaign.leads.length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Nav */}
      <nav className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 mb-6">
        <Link href="/campaigns" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Campaigns
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <a href="https://sendprop.com" target="_blank" rel="noreferrer" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          sendprop.com ↗
        </a>
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Stripe ↗
        </a>
      </nav>

      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {campaign.niche} · {campaign.location}
        </p>
        {/* Status counts */}
        {total > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(counts).map(([status, count]) => (
              <span
                key={status}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? STATUS_COLORS.new}`}
              >
                {count} {status}
              </span>
            ))}
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              {total} total
            </span>
          </div>
        )}
      </header>

      {/* Pipeline actions */}
      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
          Pipeline
        </h2>
        <div className="flex flex-wrap gap-2">
          <form action={runDiscovery.bind(null, campaign.id)}>
            <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
              1. Discover
            </button>
          </form>
          <form action={runEnrichment.bind(null, campaign.id)}>
            <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
              2. Enrich
            </button>
          </form>
          <form action={runPersonalization.bind(null, campaign.id)}>
            <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
              3. Generate drafts
            </button>
          </form>
          <div className="w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
          <form action={detectRepliesAction.bind(null, campaign.id)}>
            <button className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900">
              Detect replies
            </button>
          </form>
          <form action={runDueFollowUpsAction.bind(null, campaign.id)}>
            <button className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900">
              Send follow-ups
            </button>
          </form>
        </div>
      </section>

      {/* Lead sources (collapsible) */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <details className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
            Scrape Indeed
          </summary>
          <form
            action={async (fd: FormData) => {
              "use server";
              await scrapeIndeedForCampaign(campaign.id, fd);
            }}
            className="mt-3 space-y-3"
          >
            <textarea
              name="titles"
              rows={3}
              defaultValue="administrative assistant, office manager, receptionist, front desk, intake coordinator, billing clerk, data entry"
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs font-mono dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <div className="flex gap-2">
              <input
                name="location"
                defaultValue={campaign.location}
                placeholder="City, State"
                className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              />
              <input
                name="maxResults"
                type="number"
                defaultValue={15}
                min={5}
                max={50}
                className="w-16 rounded border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              />
            </div>
            <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
              Scrape
            </button>
          </form>
        </details>

        <details className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
            Import CSV
          </summary>
          <form
            action={async (fd: FormData) => {
              "use server";
              await importLeadsFromCsv(campaign.id, fd);
            }}
            className="mt-3 space-y-3"
          >
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Header row required. Auto-detects Apollo exports. Rows with email skip enrichment.
            </p>
            <textarea
              name="csv"
              rows={4}
              placeholder={"name,website,email\nAcme Plumbing,https://acme.example,info@acme.example"}
              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs font-mono dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
            <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
              Import
            </button>
          </form>
        </details>
      </div>

      {/* Pitch (collapsed) */}
      <details className="mb-6 text-xs text-zinc-500 dark:text-zinc-400">
        <summary className="cursor-pointer">View pitch</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-xs dark:bg-zinc-900 dark:text-zinc-300">
          {campaign.pitch}
        </pre>
      </details>

      {/* Leads */}
      <ul className="space-y-3">
        {campaign.leads.length === 0 && (
          <li className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No leads yet. Scrape Indeed, import a CSV, or run discovery.
          </li>
        )}
        {campaign.leads.map((lead) => {
          const draft = lead.drafts[0];
          const enriched = lead.enriched ? safeParse(lead.enriched) : null;
          const statusColor = STATUS_COLORS[lead.status] ?? STATUS_COLORS.new;
          return (
            <li
              key={lead.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{lead.businessName}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-medium ${statusColor}`}>
                      {lead.status}
                    </span>
                    {lead.fitScore != null && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        fit {lead.fitScore}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {lead.website && (
                      <a href={lead.website} target="_blank" rel="noreferrer" className="hover:underline">
                        {lead.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                    {lead.primaryEmail && <span>{lead.primaryEmail}</span>}
                    {lead.phone && <span>{lead.phone}</span>}
                  </div>
                  {enriched?.signals?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {enriched.signals.map((s: string) => (
                        <span key={s} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {lead.notes && (
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 italic">
                      {lead.notes}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {draft && lead.status !== "handed_off" && (
                    <form action={approveAndPushDraft.bind(null, draft.id)}>
                      <button className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400">
                        Send
                      </button>
                    </form>
                  )}
                  {lead.status === "drafted" && (
                    <form action={regenerateDraftForLead.bind(null, lead.id)}>
                      <button className="rounded border border-zinc-300 px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900">
                        Regen
                      </button>
                    </form>
                  )}
                  {lead.status === "handed_off" && !lead.repliedAt && (
                    <form action={markRepliedAction.bind(null, lead.id)}>
                      <button className="rounded border border-violet-300 px-2.5 py-1 text-xs text-violet-600 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950">
                        Replied
                      </button>
                    </form>
                  )}
                  {lead.status !== "rejected" && lead.status !== "replied" && (
                    <form action={rejectLead.bind(null, lead.id)}>
                      <button className="rounded border border-zinc-200 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-900">
                        ✕
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
                    className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  />
                  <textarea
                    name="body"
                    defaultValue={draft.body}
                    rows={5}
                    className="w-full rounded border border-zinc-200 px-2 py-1.5 font-mono text-xs leading-relaxed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  />
                  <button className="rounded border border-zinc-300 px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900">
                    Save
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

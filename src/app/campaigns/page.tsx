import Link from "next/link";
import { prisma } from "@/lib/db";
import { createCampaign } from "./actions";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <div className="flex items-baseline gap-4 text-sm">
          <Link href="/playbooks" className="text-zinc-500 hover:underline">
            playbooks →
          </Link>
          <span className="text-zinc-500">{campaigns.length} total</span>
        </div>
      </header>

      <section className="mb-10 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          New campaign
        </h2>
        <form action={createCampaign} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            name="name"
            placeholder="Internal name (e.g. ATX dentists Q2)"
            required
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="niche"
            placeholder="Niche (e.g. dental clinics)"
            required
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            name="location"
            placeholder="Location (e.g. Austin, TX)"
            required
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2"
          />
          <textarea
            name="pitch"
            placeholder="Pitch framing — what you're offering, hooks, why $200/hr is worth it. Claude uses this as guidance."
            required
            rows={3}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:col-span-2"
          />
          <button
            type="submit"
            className="justify-self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 sm:col-span-2"
          >
            Create campaign
          </button>
        </form>
      </section>

      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {campaigns.length === 0 && (
          <li className="px-6 py-8 text-center text-sm text-zinc-500">
            No campaigns yet.
          </li>
        )}
        {campaigns.map((c) => (
          <li key={c.id}>
            <Link
              href={`/campaigns/${c.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-zinc-500">
                  {c.niche} · {c.location}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span>{c._count.leads} leads</span>
                <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  {c.status}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

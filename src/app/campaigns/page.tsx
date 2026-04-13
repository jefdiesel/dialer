import Link from "next/link";
import { prisma } from "@/lib/db";
import { DEFAULT_AUDIT_PITCH } from "@/lib/defaultPitch";
import { createCampaign } from "./actions";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
  });

  return (
    <div className="px-8 py-8">
      <nav className="flex items-center gap-5 text-base text-zinc-500 dark:text-zinc-400 mb-8">
        <Link href="/playbooks" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Playbooks
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

      <div className="grid grid-cols-[1fr_2fr] gap-8 items-start">
        {/* Left: new campaign form */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 sticky top-8">
          <h2 className="mb-5 text-lg font-semibold">New campaign</h2>
          <form action={createCampaign} className="space-y-4">
            <input
              name="name"
              placeholder="Internal name (e.g. ATX dentists Q2)"
              required
              className="w-full rounded-md border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <input
              name="niche"
              placeholder="Niche (e.g. dental clinics)"
              required
              className="w-full rounded-md border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <input
              name="location"
              placeholder="Location (e.g. Austin, TX)"
              required
              className="w-full rounded-md border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <details>
              <summary className="cursor-pointer text-sm text-zinc-500 dark:text-zinc-400">
                Edit pitch (pre-filled)
              </summary>
              <textarea
                name="pitch"
                defaultValue={DEFAULT_AUDIT_PITCH}
                required
                rows={8}
                className="mt-2 w-full rounded-md border border-zinc-300 px-4 py-3 font-mono text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              />
            </details>
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-4 py-3 text-base font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Create campaign
            </button>
          </form>
        </section>

        {/* Right: campaign list */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h1 className="text-3xl font-semibold tracking-tight">Campaigns</h1>
            <span className="text-base text-zinc-500 dark:text-zinc-400">{campaigns.length} total</span>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800">
            {campaigns.length === 0 && (
              <div className="px-6 py-12 text-center text-base text-zinc-500 dark:text-zinc-400">
                No campaigns yet. Create one to get started.
              </div>
            )}
            {campaigns.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="flex items-center justify-between px-6 py-5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <div>
                  <div className="text-lg font-medium">{c.name}</div>
                  <div className="text-base text-zinc-500 dark:text-zinc-400">
                    {c.niche} · {c.location}
                  </div>
                </div>
                <div className="flex items-center gap-5 text-base">
                  <span className="text-zinc-500 dark:text-zinc-400">{c._count.leads} leads</span>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium dark:bg-zinc-800 dark:text-zinc-300">
                    {c.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

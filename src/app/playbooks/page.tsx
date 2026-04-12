import Link from "next/link";
import { prisma } from "@/lib/db";
import { generatePlaybook } from "./actions";

export const dynamic = "force-dynamic";

export default async function PlaybooksPage() {
  const playbooks = await prisma.playbook.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Industry playbooks</h1>
        <Link href="/campaigns" className="text-sm text-zinc-500 hover:underline">
          campaigns →
        </Link>
      </header>

      <section className="mb-10 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Generate from research
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Spawns a Claude session with WebSearch enabled. Takes a few minutes —
          the page will load when it&apos;s done. Result lands in <strong>draft</strong>;
          publish it manually before it affects outreach.
        </p>
        <form action={generatePlaybook} className="flex gap-2">
          <input
            name="industry"
            placeholder="e.g. dental clinics, independent law firms, HVAC contractors"
            required
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Research
          </button>
        </form>
      </section>

      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {playbooks.length === 0 && (
          <li className="px-6 py-8 text-center text-sm text-zinc-500">
            No playbooks yet.
          </li>
        )}
        {playbooks.map((p) => (
          <li key={p.id}>
            <Link
              href={`/playbooks/${p.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <div className="min-w-0">
                <div className="font-medium">{p.name}</div>
                <div className="truncate text-sm text-zinc-500">{p.summary}</div>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-sm ${
                  p.status === "published"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {p.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

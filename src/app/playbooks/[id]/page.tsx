import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { prisma } from "@/lib/db";
import {
  deletePlaybook,
  publishPlaybook,
  unpublishPlaybook,
  updatePlaybook,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function PlaybookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await prisma.playbook.findUnique({ where: { id } });
  if (!p) notFound();

  const citations = safeParse(p.citations) ?? [];
  const top3 = safeParse(p.top3UseCases) ?? [];
  const renderedHtml = marked.parse(p.markdown, { gfm: true, breaks: false }) as string;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/playbooks" className="text-xs text-zinc-500 hover:underline">
        ← all playbooks
      </Link>
      <header className="mt-2 mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
          <p className="mt-1 text-xs text-zinc-500">
            slug: <code>{p.industrySlug}</code> · model: {p.model ?? "?"} ·
            updated {p.updatedAt.toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {p.status === "draft" ? (
            <form action={publishPlaybook.bind(null, p.id)}>
              <button className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                Publish
              </button>
            </form>
          ) : (
            <form action={unpublishPlaybook.bind(null, p.id)}>
              <button className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                Unpublish
              </button>
            </form>
          )}
          <form action={deletePlaybook.bind(null, p.id)}>
            <button className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950">
              Delete
            </button>
          </form>
        </div>
      </header>

      <span
        className={`mb-6 inline-block rounded px-2 py-0.5 text-xs ${
          p.status === "published"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        }`}
      >
        {p.status}
      </span>

      <article
        className="mb-8 rounded-lg border border-zinc-200 bg-white p-8 text-sm leading-relaxed dark:border-zinc-800 dark:bg-zinc-950
          [&_h1]:mt-0 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight
          [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight
          [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold
          [&_p]:my-3
          [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6
          [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6
          [&_li]:my-1
          [&_strong]:font-semibold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100
          [&_em]:italic
          [&_hr]:my-6 [&_hr]:border-zinc-200 dark:[&_hr]:border-zinc-800
          [&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400
          [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs dark:[&_code]:bg-zinc-800
          [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-600 dark:[&_blockquote]:border-zinc-700 dark:[&_blockquote]:text-zinc-400"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

      <details className="mb-8">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Edit source
        </summary>
      <form
        action={updatePlaybook.bind(null, p.id)}
        className="mt-3 space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Name
          </label>
          <input
            name="name"
            defaultValue={p.name}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Summary (used to target outreach — never quoted in emails)
          </label>
          <textarea
            name="summary"
            defaultValue={p.summary}
            rows={2}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Top 3 use cases (JSON, fed to personalizer for fit only)
          </label>
          <textarea
            name="top3UseCases"
            defaultValue={JSON.stringify(top3, null, 2)}
            rows={8}
            className="w-full rounded border border-zinc-300 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Playbook (Markdown — the consult deliverable)
          </label>
          <textarea
            name="markdown"
            defaultValue={p.markdown}
            rows={30}
            className="w-full rounded border border-zinc-300 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
          Save edits
        </button>
      </form>
      </details>

      {citations.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Citations ({citations.length})
          </h2>
          <ul className="space-y-3">
            {citations.map((c: any, i: number) => (
              <li
                key={i}
                className="rounded border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950"
              >
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                >
                  {c.title}
                </a>
                <p className="mt-1 text-zinc-500">&ldquo;{c.quote}&rdquo;</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function safeParse(s: string | null): any {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

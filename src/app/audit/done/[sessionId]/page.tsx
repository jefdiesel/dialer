import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AuditDonePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const order = await prisma.auditOrder.findUnique({
    where: { stripeSessionId: sessionId },
  });
  if (!order) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight">You're done.</h1>
        <p className="mt-6 text-lg text-zinc-700 dark:text-zinc-300">
          Your data is uploaded. I&apos;m on it.
        </p>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Your 4-page report will land in <strong>{order.customerEmail}</strong>{" "}
          within <strong>48 hours</strong>.
        </p>
        <p className="mt-6 text-sm text-zinc-500">
          You don&apos;t need to do anything else. If 48 hours pass and you
          haven&apos;t heard from me, reply to the original email and I&apos;ll
          chase it down.
        </p>
        <hr className="my-12 border-zinc-200 dark:border-zinc-800" />
        <p className="text-xs text-zinc-500">
          Order ref: {order.id}
        </p>
      </main>
    </div>
  );
}

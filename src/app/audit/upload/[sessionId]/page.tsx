import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { acceptNdaAndUpload } from "../../actions";

export const dynamic = "force-dynamic";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const order = await prisma.auditOrder.findUnique({
    where: { stripeSessionId: sessionId },
  });
  if (!order) notFound();

  // If the webhook hasn't fired yet, show a "waiting" state with a refresh
  // hint. Stripe usually delivers within seconds.
  if (order.status === "pending") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <main className="mx-auto max-w-xl px-6 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">Confirming payment...</h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Stripe is processing your payment. This usually takes a few seconds.
            <br />
            <strong>Refresh this page</strong> in 30 seconds to continue to the upload form.
          </p>
        </main>
      </div>
    );
  }

  if (order.status === "uploaded" || order.status === "delivered") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <main className="mx-auto max-w-xl px-6 py-16">
          <h1 className="text-2xl font-semibold tracking-tight">Already submitted</h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            We received your data on{" "}
            {order.uploadedAt?.toISOString().slice(0, 10)}. Your report is in
            progress and will land in {order.customerEmail} within 48 hours of
            upload.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Upload your data</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Payment confirmed for <strong>{order.businessName}</strong>. ~10
            minutes from here. Report lands in {order.customerEmail} within 48
            hours of submission.
          </p>
        </header>

        <form
          action={acceptNdaAndUpload.bind(null, sessionId)}
          className="space-y-8 rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <section>
            <h2 className="mb-3 text-lg font-semibold">1. Mutual NDA</h2>
            <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <p className="mb-2">
                <strong>Mutual Non-Disclosure Agreement.</strong> The consultant
                and {order.businessName} (&ldquo;the parties&rdquo;) agree that
                any information shared in connection with this AI Audit
                engagement is confidential. Neither party will share, resell,
                or use the other&apos;s information for any purpose outside of
                this engagement. The consultant will delete all uploaded data
                within 14 days of report delivery. The consultant may reference
                the engagement (anonymously) in case studies only with explicit
                written consent.
              </p>
              <p>
                Both parties retain ownership of their pre-existing
                intellectual property. This NDA is governed by the laws of the
                State of Texas. By checking the box below, you confirm you have
                authority to enter into this agreement on behalf of{" "}
                {order.businessName}.
              </p>
            </div>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" name="nda" required className="mt-1" />
              <span>
                I accept the mutual NDA above on behalf of {order.businessName}.
              </span>
            </label>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">2. Upload data</h2>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              Anything you can pull in 10 minutes is enough. Common things to
              upload:
            </p>
            <ul className="mb-3 list-disc space-y-1 pl-6 text-sm text-zinc-600 dark:text-zinc-400">
              <li>5 recent customer emails (forwarded as .eml or screenshots)</li>
              <li>5 recent vendor / supplier emails</li>
              <li>A photo or scan of whatever paperwork is on your desk</li>
              <li>Your SOPs / process documents (any format)</li>
              <li>An export from your booking/CRM/PMS system if convenient</li>
              <li>Your last 90 days of invoices (CSV from QuickBooks, etc.)</li>
            </ul>
            <input
              type="file"
              name="files"
              multiple
              className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm file:mr-4 file:rounded file:border-0 file:bg-zinc-200 file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-zinc-300 dark:border-zinc-700 dark:file:bg-zinc-800 dark:hover:file:bg-zinc-700"
            />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">
              3. Anything else you want me to know? (optional)
            </h2>
            <textarea
              name="notes"
              rows={4}
              placeholder="What's the thing that makes you say 'god damn it' most often in a week? What have you tried before? Anything I should know about your business?"
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </section>

          <button
            type="submit"
            className="w-full rounded bg-emerald-500 px-6 py-3 text-base font-semibold text-zinc-900 transition hover:bg-emerald-400"
          >
            Submit and start the audit →
          </button>
        </form>
      </main>
    </div>
  );
}

import Link from "next/link";
import { createCheckoutSession } from "./actions";

export const metadata = {
  title: "AI Audit — $400 written report in 48 hours",
  description:
    "I review your business and write you a 4-page report on the 3 places AI could save you real money. $400, 48 hours, no meeting, full refund if it's not worth $10k/year.",
};

export default function AuditLandingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
            The AI Audit
          </h1>
          <p className="mt-4 text-xl leading-8 text-zinc-600 dark:text-zinc-400">
            $400. 4-page written report. 48 hours. No meeting.
          </p>
        </header>

        <section className="space-y-6 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
          <p>
            You&apos;re running a small business. You&apos;ve heard you should be
            using AI for something. You opened ChatGPT once, asked it about your
            shop, got a generic answer, and closed the tab.
          </p>
          <p>
            I take a small sample of your operations &mdash; 5 customer emails,
            5 vendor emails, a photo of whatever paperwork is on your desk
            &mdash; and write you a 4-page report identifying the 3 specific
            places AI could save you real money. Specific to your shop. With
            dollar figures.
          </p>
          <p>
            Two recommendations will be DIY (with the exact prompts and a setup
            guide). One will be a custom build I could do for you, fixed price.
            You decide what to act on.
          </p>
        </section>

        <section className="my-12 rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            How it works
          </h2>
          <ol className="mt-4 space-y-3 text-zinc-700 dark:text-zinc-300">
            <li className="flex gap-3">
              <span className="font-mono text-zinc-400">1.</span>
              <span>
                You pay $400. I send you a private upload link.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-zinc-400">2.</span>
              <span>
                You sign a mutual NDA (one click) and upload a small sample of
                your operations. ~10 minutes of your time.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-zinc-400">3.</span>
              <span>
                Within 48 hours I email you a 4-page PDF report. Three specific
                recommendations, dollar figures, next actions.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-zinc-400">4.</span>
              <span>
                If the recommendations aren&apos;t worth at least $10k/year to
                your business, reply &ldquo;refund&rdquo; within 7 days and I
                send your money back. No questions.
              </span>
            </li>
          </ol>
        </section>

        <section className="my-12">
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            What you don&apos;t have to do
          </h2>
          <ul className="space-y-2 text-zinc-700 dark:text-zinc-300">
            <li>&mdash; No meetings.</li>
            <li>&mdash; No Zoom calls.</li>
            <li>&mdash; No sales pitch.</li>
            <li>&mdash; No follow-up emails from me unless you ask.</li>
            <li>&mdash; No subscription. One-time fee.</li>
          </ul>
        </section>

        <section className="my-12 rounded-lg bg-zinc-900 p-8 text-zinc-50 dark:bg-zinc-800">
          <form action={createCheckoutSession} className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Start your audit
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                name="customerName"
                placeholder="Your name"
                required
                className="rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-base placeholder:text-zinc-500"
              />
              <input
                name="businessName"
                placeholder="Business name"
                required
                className="rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-base placeholder:text-zinc-500"
              />
              <input
                name="customerEmail"
                type="email"
                placeholder="Your email"
                required
                className="rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-base placeholder:text-zinc-500 sm:col-span-2"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded bg-emerald-500 px-6 py-3 text-base font-semibold text-zinc-900 transition hover:bg-emerald-400"
            >
              Pay $400 and start →
            </button>
            <p className="text-center text-xs text-zinc-400">
              Secure payment via Stripe. You&apos;ll be redirected to a checkout
              page, then to the upload form.
            </p>
          </form>
        </section>

        <footer className="mt-16 border-t border-zinc-200 pt-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
          <p>
            Questions? Reply to the email I sent you, or{" "}
            <Link href="mailto:hello@sendprop.com" className="underline">
              hello@sendprop.com
            </Link>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

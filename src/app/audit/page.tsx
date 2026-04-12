import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Audit — What Could AI Do for Your Business?",
  description:
    "A focused audit of your operations and a written report showing you exactly where AI fits. $400 flat.",
};

export default function AuditPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="px-6 pt-24 pb-20 max-w-3xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Your business was built on years of hard work. The next chapter starts
          with <em>letting it grow.</em>
        </h1>
        <p className="mt-8 text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
          AI isn&rsquo;t replacing what you&rsquo;ve built. It&rsquo;s the thing
          that finally lets it scale. A focused audit of your operations — and a
          written report showing you exactly where.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <a
            href="#book"
            className="inline-block bg-gray-900 text-white text-lg font-semibold px-8 py-4 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Book the Audit
          </a>
          <p className="text-gray-500 text-sm tracking-wide">
            $400 flat &middot; Report in 48 hours
          </p>
        </div>
      </section>

      {/* The moment */}
      <section className="px-6 py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight">The moment</h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-700">
            Something shifted. You can feel it.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-gray-700">
            Every industry. Every size. The businesses that figure out where AI
            fits — specifically, in their operation, with their team — are the
            ones that pull ahead. Not because the technology is magic. Because it
            frees up the thing that actually matters: your time, your attention,
            your ability to grow.
          </p>
          <div className="mt-10 space-y-4">
            {[
              "What if every quote went out in minutes instead of days?",
              "What if the knowledge in your head was available to your whole team — instantly?",
              "What if you could take on more work without adding headcount?",
              "What if next year looked completely different — because this year, you let it?",
            ].map((q) => (
              <p
                key={q}
                className="text-lg italic text-gray-600 leading-relaxed"
              >
                {q}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight">What you get</h2>
          <p className="mt-2 text-lg text-gray-500">Not a pitch. A map.</p>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed">
            A written report, specific to your business, delivered within 48
            hours of our conversation.
          </p>
          <ul className="mt-10 space-y-8">
            {[
              {
                title: "Every opportunity, sized in dollars",
                desc: "What changes, what it saves, what the first week looks like — specific to your revenue, your team, your workflows.",
              },
              {
                title: "Solutions designed around how you actually work",
                desc: "Not a product demo. Custom recommendations — some free, some built — shaped to fit the way your business already runs.",
              },
              {
                title: "Clarity on what AI won't do",
                desc: "So you invest in the right things now and skip the expensive wrong turns.",
              },
            ].map((item) => (
              <li key={item.title}>
                <p className="font-semibold text-lg">{item.title}</p>
                <p className="mt-1 text-gray-600 leading-relaxed">
                  {item.desc}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <p className="mt-2 text-lg text-gray-500">
            Under an hour of your time. A roadmap in return.
          </p>
          <ol className="mt-10 space-y-10">
            {[
              {
                step: "1",
                title: "15-minute call",
                desc: "A quick conversation to see if it\u2019s a fit. We sign a mutual NDA.",
              },
              {
                step: "2",
                title: "20-minute conversation about your operations",
                desc: "How your business actually runs. Where the time goes. What you\u2019d change if you could.",
              },
              {
                step: "3",
                title: "Two hours of analysis",
                desc: "Your operations examined for automation, revenue, and the opportunities hiding in plain sight.",
              },
              {
                step: "4",
                title: "Report delivered within 48 hours",
                desc: "Written report. Branded PDF. Yours to keep, share with your team, and act on.",
              },
              {
                step: "5",
                title: "30-minute walkthrough",
                desc: "Every recommendation explained. Your questions answered. Next steps \u2014 if you want them \u2014 laid out.",
              },
            ].map((item) => (
              <li key={item.step} className="flex gap-6">
                <span className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm">
                  {item.step}
                </span>
                <div>
                  <p className="font-semibold text-lg">{item.title}</p>
                  <p className="mt-1 text-gray-600">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Who this is for */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight">
            Who this is for
          </h2>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed">
            You&rsquo;ve built something real. Now you&rsquo;re hearing
            &ldquo;AI&rdquo; from every direction — and you want someone to sit
            down with your operation and tell you what&rsquo;s actually worth
            doing.
          </p>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            Businesses running $500K–$5M in revenue — whether the work runs on
            job sites, kitchens, storefronts, client calls, or spreadsheets. If
            your team spends time on tasks that feel like they should be faster
            by now, there&rsquo;s probably a reason.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight">
            Common questions
          </h2>
          <dl className="mt-10 space-y-8">
            {[
              {
                q: "We\u2019ve played with ChatGPT. How is this different?",
                a: "That\u2019s actually the perfect starting point. You\u2019ve seen what\u2019s possible \u2014 now the question is how to wire it into the way your business actually operates. That\u2019s what the audit maps out.",
              },
              {
                q: "Is this a sales pitch for software?",
                a: "No. Sometimes the right answer is a free tool you set up yourself. Sometimes it\u2019s something custom. The report tells you which is which \u2014 and you decide what to do with it.",
              },
              {
                q: "What happens after the audit?",
                a: "The report is yours \u2014 every recommendation includes steps your team can take on their own. If something needs building, fixed-price proposals are available. No retainers. No open-ended consulting.",
              },
            ].map((item) => (
              <div key={item.q}>
                <dt className="font-semibold text-lg italic">{item.q}</dt>
                <dd className="mt-2 text-gray-600 leading-relaxed">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA */}
      <section id="book" className="px-6 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl text-gray-700 leading-relaxed">
            The businesses that move now are the ones that lead next year.
          </p>
          <p className="mt-4 text-lg text-gray-500">
            $400 flat. Under an hour of your time. A written report in 48 hours.
          </p>
          <a
            href="mailto:jef@sendprop.com?subject=AI%20Audit"
            className="mt-10 inline-block bg-gray-900 text-white text-lg font-semibold px-8 py-4 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Book the Audit
          </a>
          <p className="mt-6 text-sm text-gray-400">
            If the recommendations aren&rsquo;t collectively worth at least
            $10,000/year to your business, full refund.
          </p>
        </div>
      </section>
    </main>
  );
}

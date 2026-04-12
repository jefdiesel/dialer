import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — SendProp",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <article className="px-6 py-24 max-w-3xl mx-auto prose prose-gray">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-gray-500">Effective April 12, 2026</p>

        <p>
          These terms govern your use of sendprop.com and the services provided
          by SendProp LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo;
          &ldquo;our&rdquo;). By using our website or purchasing our services,
          you agree to these terms.
        </p>

        <h2>Services</h2>
        <p>
          We provide AI readiness audits and consulting for businesses. Services
          include a consultation, a written audit report, and a follow-up
          walkthrough as described on our website at the time of purchase.
        </p>

        <h2>Payment</h2>
        <p>
          All fees are listed on our website and charged at the time of
          purchase. Payments are processed securely by Stripe. Prices are in USD
          unless otherwise stated.
        </p>

        <h2>Refund policy</h2>
        <p>
          If the recommendations in your audit report are not collectively worth
          at least $10,000 per year to your business, we will issue a full
          refund. Refund requests must be made within 14 days of report
          delivery by emailing{" "}
          <a href="mailto:jef@sendprop.com">jef@sendprop.com</a>.
        </p>

        <h2>Intellectual property</h2>
        <p>
          Upon payment, you own the audit report delivered to you. We retain the
          right to use anonymized, aggregated insights from engagements to
          improve our services.
        </p>

        <h2>Confidentiality</h2>
        <p>
          Information shared during engagements is treated as confidential. When
          a mutual NDA is signed, its terms govern. We will not share your
          business information with third parties without your consent.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          Our services are advisory. We are not liable for business decisions
          made based on our recommendations. Our total liability is limited to
          the amount you paid for the service.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          We may update these terms from time to time. Changes will be posted
          on this page with an updated effective date. Continued use of our
          services constitutes acceptance of updated terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms? Email{" "}
          <a href="mailto:jef@sendprop.com">jef@sendprop.com</a>.
        </p>
      </article>
    </main>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — SendProp",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <article className="px-6 py-24 max-w-3xl mx-auto prose prose-gray">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-gray-500">Effective April 12, 2026</p>

        <p>
          SendProp LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;)
          operates sendprop.com. This policy describes the information we
          collect, how we use it, and the choices you have.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Information you provide:</strong> name, email address,
            business name, phone number, and any details you share during
            consultations or through our contact forms.
          </li>
          <li>
            <strong>Payment information:</strong> payment details are collected
            and processed by Stripe. We do not store credit card numbers on our
            servers.
          </li>
          <li>
            <strong>Automatically collected information:</strong> IP address,
            browser type, pages visited, and referring URL via standard server
            logs.
          </li>
        </ul>

        <h2>How we use your information</h2>
        <ul>
          <li>To deliver the services you purchase (audit reports, consulting).</li>
          <li>To communicate with you about your engagement.</li>
          <li>To process payments.</li>
          <li>To improve our website and services.</li>
        </ul>

        <h2>Who we share it with</h2>
        <ul>
          <li>
            <strong>Stripe:</strong> for payment processing.
          </li>
          <li>
            <strong>Email providers:</strong> to send you communications related
            to your engagement.
          </li>
        </ul>
        <p>
          We do not sell, rent, or trade your personal information to third
          parties for marketing purposes.
        </p>

        <h2>Security</h2>
        <p>
          We use commercially reasonable measures to protect your information,
          including encrypted connections (TLS) and secure third-party payment
          processing. No method of transmission over the internet is 100%
          secure, but we take reasonable steps to protect your data.
        </p>

        <h2>Your choices</h2>
        <p>
          You may request access to, correction of, or deletion of your
          personal information by emailing us at{" "}
          <a href="mailto:jef@sendprop.com">jef@sendprop.com</a>.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Changes will be posted on
          this page with an updated effective date.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy? Email{" "}
          <a href="mailto:jef@sendprop.com">jef@sendprop.com</a>.
        </p>
      </article>
    </main>
  );
}

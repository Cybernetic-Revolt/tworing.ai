import { H2, LegalShell } from "../legal-shell";

export const metadata = {
  title: "Terms of Service — TwoRing",
  description:
    "The terms governing use of the TwoRing AI receptionist service, operated by Bilco Works Inc.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="June 13, 2026">
      <p>
        These terms govern your use of TwoRing, operated by{" "}
        <strong>Bilco Works Inc.</strong> By using the service you agree to them.
      </p>

      <H2>The service</H2>
      <p>
        TwoRing answers your business calls with an AI receptionist, books
        appointments into a calendar you control, captures leads, and gives you a
        portal to see it all. We provision the service; you forward your number
        to it. You keep your number and your carrier.
      </p>

      <H2>What the AI does and does not do</H2>
      <p>
        The assistant schedules appointments and relays information. It does{" "}
        <strong>not</strong> give binding price quotes, enter contracts, or
        provide professional advice on your behalf. Final confirmation of any
        job, price, or commitment rests with you. You are responsible for the
        services you deliver to your customers.
      </p>

      <H2>Emergencies</H2>
      <p>
        TwoRing is not an emergency service. If a caller describes a life-safety
        situation (such as a gas leak, carbon monoxide alarm, electrical fire, or
        flooding near electrical equipment), the assistant directs them to hang
        up and call 911 or the relevant utility, and flags it to you urgently —
        but it cannot dispatch emergency services and must not be relied upon for
        that purpose.
      </p>

      <H2>Acceptable use</H2>
      <p>
        Use the service lawfully. Don&apos;t use it for harassment, fraud, or to
        violate telecommunications or anti-spam rules. You are responsible for
        obtaining any consents required to record or message your customers,
        which the service is designed to help you do.
      </p>

      <H2>Billing</H2>
      <p>
        Plans are billed monthly in Canadian dollars through Stripe, plus
        applicable GST. Each plan includes a monthly allotment of AI minutes;
        usage beyond that is billed at the per-minute rate shown at sign-up.
        Plans are month-to-month and you can cancel anytime; cancellation takes
        effect at the end of the current billing period.
      </p>

      <H2>Your number</H2>
      <p>
        If you forward an existing number, it remains yours. If we provisioned a
        number for you and you leave, we will port it out to your chosen carrier
        promptly and without exit fees. We will never hold your number hostage.
      </p>

      <H2>Uptime and failover</H2>
      <p>
        We aim for high availability but do not guarantee uninterrupted service.
        Numbers we manage are configured with carrier-level failover so that if
        the AI is unreachable, calls fall through to your designated phone or
        voicemail.
      </p>

      <H2>Your data</H2>
      <p>
        You own your business and customer data. You can export it anytime, and
        we handle it as described in our{" "}
        <a href="/privacy" className="text-emerald-600 dark:text-emerald-400 hover:underline">
          Privacy Policy
        </a>
        .
      </p>

      <H2>Limitation of liability</H2>
      <p>
        The service is provided &quot;as is.&quot; To the extent permitted by
        law, Bilco Works Inc. is not liable for indirect or consequential losses,
        including missed calls, lost business, or booking errors, and our total
        liability for any claim is limited to the fees you paid us in the three
        months before the claim arose.
      </p>

      <H2>Governing law</H2>
      <p>
        These terms are governed by the laws of Alberta and the federal laws of
        Canada applicable there. Questions: <strong>support@tworing.ai</strong>.
      </p>
    </LegalShell>
  );
}

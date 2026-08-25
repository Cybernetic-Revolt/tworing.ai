import { H2, LegalShell } from "../legal-shell";

export const metadata = {
  title: "Privacy Policy — TwoRing",
  description:
    "How TwoRing (Bilco Works Inc.) collects, uses, stores, and protects personal information, in line with PIPEDA and Alberta PIPA.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 13, 2026">
      <p>
        TwoRing is operated by <strong>Bilco Works Inc.</strong> (&quot;TwoRing&quot;,
        &quot;we&quot;, &quot;us&quot;), based in Calgary, Alberta, Canada. This
        policy explains what personal information we handle when a business uses
        our AI receptionist service and when a person calls a phone number we
        answer on a business&apos;s behalf. We follow Canada&apos;s PIPEDA and
        Alberta&apos;s Personal Information Protection Act (PIPA).
      </p>

      <H2>Information we handle</H2>
      <p>
        <strong>From our business clients:</strong> business name, contact name,
        email, phone number, service settings, and billing details.
      </p>
      <p>
        <strong>From callers</strong> (people who phone a client&apos;s line that
        we answer): the phone number, the call audio recording and its
        transcript, and any details a caller provides — such as name, address,
        the service requested, and appointment preferences.
      </p>

      <H2>How we use it</H2>
      <p>
        To answer and route calls, book appointments, capture and deliver leads
        to the business, send confirmations and summaries, provide the client
        portal, meter usage for billing, and improve service quality. We do not
        sell personal information, and we do not use call content for advertising.
      </p>

      <H2>AI and call recording</H2>
      <p>
        Calls are answered by an automated AI assistant, and this — along with
        the fact that calls are recorded — is disclosed to callers at the start
        of every call. Recordings and transcripts exist so the business has an
        accurate record of what was said and requested.
      </p>

      <H2>Where it is stored</H2>
      <p>
        Personal information is stored on servers located in Canada. A small
        number of service providers process data to make the service work:
        telephony and SMS (VoIP.ms), the AI voice platform (Vapi), email
        delivery (Resend), calendar sync where a client connects it (Google),
        and payment processing (Stripe). Each receives only what it needs to
        perform its function.
      </p>

      <H2>How long we keep it</H2>
      <p>
        Call recordings and transcripts are retained for 13 months by default
        and then deleted, unless a client configures a different period. Leads,
        appointments, and message history are kept for the life of the
        client&apos;s account and for 90 days after the account closes, after
        which they are erased. Security and audit logs are kept for 24 months.
      </p>

      <H2>Your rights</H2>
      <p>
        You may ask what personal information we hold about you, request a copy,
        ask us to correct it, or ask us to delete it, subject to legal limits.
        Business clients can export their data anytime from the portal. A caller
        who wants to exercise these rights can contact us and we will respond
        within the timelines PIPEDA and Alberta PIPA require.
      </p>

      <H2>Text messages</H2>
      <p>
        Where SMS is used, messages are transactional (confirmations, reminders,
        follow-ups) and sent only with the consent required under Canada&apos;s
        anti-spam legislation (CASL). Reply STOP to any message to opt out; we
        honour opt-outs automatically.
      </p>

      <H2>Security</H2>
      <p>
        We protect information with encryption in transit, access controls,
        encrypted storage of sensitive credentials, and regular backups. No
        system is perfectly secure, but we work to safeguard your information and
        will notify affected parties of any material breach as required by law.
      </p>

      <H2>Contact</H2>
      <p>
        Questions or requests: <strong>privacy@tworing.ai</strong>, or write to
        Bilco Works Inc., Calgary, Alberta. If you are not satisfied with our
        response, you may contact the Office of the Privacy Commissioner of
        Canada or the Office of the Information and Privacy Commissioner of
        Alberta.
      </p>
    </LegalShell>
  );
}

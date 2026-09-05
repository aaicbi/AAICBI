import SiteHeader from "@/components/SiteHeader";

/**
 * The actual destination of the "Privacy Policy" link in the
 * registration consent checkbox (src/app/trainee/register/page.tsx).
 * A checkbox linking to a policy that isn't actually reachable inside
 * the running app would be consent in name only — this makes sure a
 * trainee can genuinely read what they're agreeing to before they tick
 * the box, not just trust that a document exists somewhere.
 *
 * This text should match docs/AAICBI_LMS_Privacy_Policy.docx exactly —
 * that Word document is the one meant for formal legal review and
 * external hosting (e.g. futybills.com); this page is the same content
 * made reachable from inside the product itself. If one changes, update
 * both — see the top of the Word doc for the same reminder in reverse.
 *
 * IMPORTANT: this is a draft prepared with AI assistance. It should be
 * reviewed by a Nigerian data protection lawyer before AAICBI relies on
 * it as an actual, binding privacy policy — see the notice at the
 * bottom of this page and the equivalent one in the Word document.
 */
export default function PrivacyPolicyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">
          AAICBI Learning Management System — Privacy Policy
        </h1>
        <p className="mt-1 text-sm text-gray-500">Last updated: [date] — Version 1.1 (draft)</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-700">
          <section>
            <h2 className="text-base font-bold text-brand-teal">1. Who We Are</h2>
            <p className="mt-2">
              This policy covers the AAICBI Learning Management System (the &quot;Platform&quot;), operated by
              Africa&apos;s AI Capacity Building Initiative (&quot;AAICBI&quot;, &quot;we&quot;, &quot;us&quot;) as part of
              Futybills Tech Community, based in Uyo, Akwa Ibom State, Nigeria. This policy is
              specific to the Platform — it covers data collected through course registration,
              enrollment, assessments, and progress tracking, and works alongside (not instead of)
              any wider AAICBI/Futybills organisational privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-brand-teal">2. What We Collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Account information:</strong> your name, email address, and (optionally)
                phone number, when you register as a trainee.
              </li>
              <li>
                <strong>Course activity:</strong> which courses, modules, and lessons you access;
                assessment attempts, scores, and pass/fail results; certificates issued to you.
              </li>
              <li>
                <strong>Technical information:</strong> your IP address, captured briefly to enforce
                login rate limits that protect your account from unauthorised access attempts.
              </li>
              <li>
                <strong>Consent record:</strong> the date and time you agreed to this policy, kept as
                evidence that consent was actually given, not just requested.
              </li>
              <li>
                <strong>Notification records:</strong> when we send you an account or course email
                (see Section 9), we keep a record that it was sent (or that sending failed) — not
                the email content itself, and not tied to a copy of your email address beyond
                what&apos;s already in your account information above.
              </li>
            </ul>
            <p className="mt-2">
              We do not collect more than this. If a future version of the Platform needs to
              collect something new, this policy will be updated first.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-brand-teal">3. Why We Collect It (Lawful Basis)</h2>
            <p className="mt-2">
              We process your data on two grounds recognised under the Nigeria Data Protection Act
              2023: your <strong>consent</strong> (given at registration, and withdrawable at any
              time — see Section 7), and <strong>contractual necessity</strong> — we can&apos;t
              actually deliver a course, grade an assessment, or issue a certificate without
              knowing who you are and tracking your progress through it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-brand-teal">4. How We Use It</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>To create and maintain your trainee account.</li>
              <li>To let you enroll in and progress through courses.</li>
              <li>To administer and grade timed assessments securely.</li>
              <li>To issue and verify certificates of completion.</li>
              <li>To protect your account (rate limiting failed login attempts).</li>
              <li>
                To send you account and course emails — a verification email when you register, a
                password reset email if you request one, a notification when you unlock the next
                module in a course, and your assessment results after you submit an attempt (see
                Section 9). Verification and password-reset emails are essential to using the
                Platform. Module-unlock and assessment-result notifications are optional — contact
                us if you&apos;d like them turned off for your account (a self-service toggle for
                this is planned but not built yet).
              </li>
            </ul>
            <p className="mt-2">We do not sell your data. We do not use it for advertising. We do not share it with third parties except where Section 6 applies.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-brand-teal">5. How Long We Keep It</h2>
            <p className="mt-2">
              We keep your account and course records for as long as your account is active, and
              for a reasonable period afterward to support certificate verification (see the
              Platform roadmap&apos;s M15 milestone) — currently planned as 3 years after your last
              activity, subject to review. You can request earlier deletion under Section 7.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-brand-teal">6. Who We Share It With</h2>
            <p className="mt-2">
              We use third-party infrastructure to run the Platform — a hosting provider, a database
              provider, and (for the account and course emails described in Section 9) an email
              delivery provider — all acting only as data processors under our instructions, not as
              independent users of your data. If any of this infrastructure is hosted outside
              Nigeria, we take reasonable steps to ensure it offers a comparable level of
              protection, consistent with the Nigeria Data Protection Act&apos;s cross-border
              transfer requirements. We do not share your data with any other third party without
              telling you first, except where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-brand-teal">7. Your Rights</h2>
            <p className="mt-2">Under the Nigeria Data Protection Act 2023, you have the right to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Ask what personal data we hold about you.</li>
              <li>Ask us to correct inaccurate data.</li>
              <li>Ask us to delete your data, subject to Section 5&apos;s certificate-verification exception.</li>
              <li>Withdraw your consent at any time (this may limit your access to the Platform).</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at the address in Section 10. We aim to
              respond within a reasonable time.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-brand-teal">8. How We Protect It</h2>
            <p className="mt-2">
              Passwords are never stored in plain text. Assessment answers are never sent to your
              browser before you submit. Access to trainee and course data is restricted by role —
              only staff who created a course can edit it. Login attempts are rate-limited against
              brute-force guessing.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-brand-teal">9. Notifications</h2>
            <p className="mt-2">
              The Platform sends email notifications for: account verification and password resets
              (essential — needed to use the Platform), and unlocking the next module in a course or
              receiving an assessment result (optional — see Section 4 for how to turn these off).
              If your assessment result is configured to be released later rather than shown
              immediately, no result email is sent until you can see that result yourself in the
              Platform — the two are never out of sync.
            </p>
            <p className="mt-2">
              WhatsApp notifications are not active yet — this section will be updated when that
              changes. See Section 6 for who processes notification content on our behalf.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-brand-teal">10. Contact</h2>
            <p className="mt-2">
              For any question about this policy or your data, contact AAICBI at [insert contact
              email] or in writing at [insert AAICBI address, Uyo, Akwa Ibom State, Nigeria].
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-brand-teal">11. Changes to This Policy</h2>
            <p className="mt-2">
              If this policy changes in a way that affects how your existing data is used, we will
              take reasonable steps to let registered trainees know before the change takes effect.
            </p>
          </section>
        </div>

        <div className="mt-10 rounded-lg border border-brand-gold bg-brand-goldLight/40 p-4 text-xs text-brand-goldText">
          <strong>Draft notice:</strong> this policy was prepared with AI assistance as a starting
          point aligned with the Nigeria Data Protection Act 2023. It has not been reviewed by a
          qualified Nigerian data protection lawyer. AAICBI should have it reviewed before relying
          on it as a binding policy, and should fill in the bracketed placeholders above
          ([date], [insert contact email], [insert AAICBI address]) before publishing it.
        </div>
      </main>
    </>
  );
}

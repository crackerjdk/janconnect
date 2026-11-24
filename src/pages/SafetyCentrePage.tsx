import { Link } from 'react-router-dom';
import { Shield, Lock, Flag, HelpCircle, Scale } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { IndependentNotice } from '../components/ui/IndependentNotice';

export function SafetyCentrePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#0F2942]">जनConnect Safety Centre</h1>
          <p className="mt-2 text-base text-[#4B5563]">
            Community guidelines, privacy safeguards, minor protection rules, and how to appeal or report unsafe content.
          </p>
        </div>

        <IndependentNotice />

        <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-[#0F2942] inline-flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0D7A6F]" aria-hidden="true" />
            <span>Community Guidelines</span>
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-[#374151] leading-relaxed">
            <li>Focus reports on public infrastructure, utilities, sanitation, and shared civic spaces.</li>
            <li>Do not post defamatory allegations against private individuals or unverified personal accusations.</li>
            <li>Never upload photos showing private home interiors, vehicle license plates of private citizens, or children’s faces.</li>
            <li>Direct messaging between users is disabled in V0.1 to prevent unsolicited private contact.</li>
          </ul>
        </section>

        <section id="privacy" className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-[#0F2942] inline-flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#0D7A6F]" aria-hidden="true" />
            <span>Privacy, PII & Minor Protection</span>
          </h2>
          <p className="text-sm text-[#374151] leading-relaxed">
            जनConnect collects only minimal profile fields. Public profiles never display phone numbers, email
            addresses, dates of birth, school details, or exact residential GPS coordinates. EXIF/GPS metadata is
            stripped from uploaded JPEG and PNG images on our server before storage.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold inline-flex items-center gap-2">
              <Scale className="w-4 h-4" aria-hidden="true" />
              <span>All-Ages Registration & Legal Review Gate</span>
            </p>
            <p className="mt-1 leading-relaxed">
              जनConnect is intended for all ages, but production all-ages registration remains gated until an adult
              project operator and qualified legal/privacy reviewer approve applicable age-assurance, parental-consent,
              and child-safety requirements.
            </p>
          </div>
        </section>

        <section id="terms" className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-[#0F2942] inline-flex items-center gap-2">
            <Flag className="w-5 h-5 text-[#0D7A6F]" aria-hidden="true" />
            <span>Reporting Content & Appeals</span>
          </h2>
          <p className="text-sm text-[#374151] leading-relaxed">
            Every published report and comment includes a <strong>Report</strong> button. Flagged items are reviewed by
            human moderators who record an append-only moderation decision. If your own report was declined or more
            context was requested, you can view the moderator reason in{' '}
            <Link to="/my-reports" className="font-semibold text-[#0F2942] underline">
              My Reports
            </Link>{' '}
            and submit an updated report or contact safety support for correction review.
          </p>
        </section>

        <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-2">
          <h2 className="font-display text-lg font-semibold text-[#0F2942] inline-flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#0D7A6F]" aria-hidden="true" />
            <span>Safety & Help Desk Contact Placeholder</span>
          </h2>
          <p className="text-sm text-[#374151]">
            Grievance & Safety Contact (Placeholder for production operator):{' '}
            <span className="font-mono text-[#0F2942]">safety@janconnect.example</span>
          </p>
          <p className="text-xs text-[#6B7280]">
            Note: In a life-threatening emergency, always contact official emergency services (112 in India) directly.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

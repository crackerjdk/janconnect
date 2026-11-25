import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, MapPin, Eye, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { IndependentNotice } from '../components/ui/IndependentNotice';
import { REPORT_CATEGORIES } from '../utils/civicRules';
import { useAuth } from '../context/AuthContext';

export function LandingPage() {
  const { user } = useAuth();
  const [heroImgErr, setHeroImgErr] = useState(false);
  const [commImgErr, setCommImgErr] = useState(false);
  const [transImgErr, setTransImgErr] = useState(false);

  return (
    <AppShell>
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden border-b border-[#E2E6EC] bg-gradient-to-r from-[#FAF9F6]/80 via-[#FAF9F6]/45 to-[#FAF9F6]/15">
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-semibold tracking-wide text-[#0D7A6F]">
                Independent Civic Visibility · Launching in Uttarakhand, India
              </p>
              <h1
                className="mt-3 font-display font-bold tracking-tight text-[#0F2942] [text-wrap:balance]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', lineHeight: 1.1 }}
              >
                Your Voice. Your State. Your Accountability.
              </h1>
              <p className="mt-5 max-w-xl text-base text-[#374151] leading-relaxed">
                Report local problems. Discover what is happening around you. Bring community attention to the issues
                that matter.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to={user ? '/reports/create' : '/signup'}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0D7A6F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0A635A] transition-colors whitespace-nowrap"
                >
                  <span>Report a Problem</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/explore"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E2E6EC] bg-white px-5 py-3 text-sm font-semibold text-[#0F2942] hover:bg-[#F7F6F2] transition-colors whitespace-nowrap"
                >
                  <span>Explore Reports</span>
                </Link>
                <Link
                  to="/contractors"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E2E6EC] bg-white px-5 py-3 text-sm font-semibold text-[#0D7A6F] hover:bg-[#F7F6F2] transition-colors whitespace-nowrap"
                >
                  <span>Contractor Bids</span>
                </Link>
              </div>

              <div className="mt-8 pt-6 border-t border-[#E2E6EC] grid grid-cols-3 gap-4 text-xs text-[#4B5563]">
                <div>
                  <p className="font-semibold text-[#0F2942]">Human Moderated</p>
                  <p className="mt-0.5">Reviewed before public listing</p>
                </div>
                <div>
                  <p className="font-semibold text-[#0F2942]">Contractor Bidding</p>
                  <p className="mt-0.5">Transparent repair quotations</p>
                </div>
                <div>
                  <p className="font-semibold text-[#0F2942]">13 Districts · 95 Blocks</p>
                  <p className="mt-0.5">Uttarakhand village & ward ready</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] lg:min-h-[420px] rounded-xl overflow-hidden border border-[#E2E6EC] bg-[#0F2942]">
                {!heroImgErr ? (
                  <img
                    src="/src/assets/images/hero_uttarakhand_civic_1795508409770.jpg"
                    alt="Morning view of a hillside civic road and pedestrian walkway in Uttarakhand, India"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgErr(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-white">
                    <MapPin className="w-8 h-8 text-[#0D7A6F] mb-3" aria-hidden="true" />
                    <p className="font-display text-lg font-semibold">Uttarakhand Civic Infrastructure</p>
                    <p className="mt-1 text-sm text-slate-300">
                      Dehradun · Haridwar · Nainital · Garhwal & Kumaon Divisions
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How जनConnect Works */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="max-w-2xl rounded-xl border border-[#E2E6EC] bg-white/85 backdrop-blur-[2px] p-5 sm:p-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">How जनConnect works</h2>
          <p className="mt-2 text-sm sm:text-base text-[#4B5563]">
            Every submission follows a deliberate, human-reviewed workflow designed for citizen privacy and public
            clarity.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-[#E2E6EC] bg-white p-6">
            <p className="font-mono text-xs font-semibold text-[#0D7A6F]">01. Document & Submit</p>
            <h3 className="mt-2 font-display text-lg font-semibold text-[#0F2942]">Share local context safely</h3>
            <p className="mt-2 text-sm text-[#4B5563] leading-relaxed">
              Describe a road, water, electricity, sanitation, or public-space issue using Uttarakhand’s district,
              block, and locality structure. Metadata is stripped from uploaded photos automatically.
            </p>
          </div>
          <div className="rounded-xl border border-[#E2E6EC] bg-white p-6">
            <p className="font-mono text-xs font-semibold text-[#0D7A6F]">02. Human Review Queue</p>
            <h3 className="mt-2 font-display text-lg font-semibold text-[#0F2942]">Checked before publication</h3>
            <p className="mt-2 text-sm text-[#4B5563] leading-relaxed">
              New reports enter a private moderation queue first. Moderators check for personal information exposure,
              spam, and duplicate entries before making a report publicly visible.
            </p>
          </div>
          <div className="rounded-xl border border-[#E2E6EC] bg-white p-6">
            <p className="font-mono text-xs font-semibold text-[#0D7A6F]">03. Community Visibility</p>
            <h3 className="mt-2 font-display text-lg font-semibold text-[#0F2942]">Discover & support together</h3>
            <p className="mt-2 text-sm text-[#4B5563] leading-relaxed">
              Residents in your district can read published reports, add one verified support per issue, discuss local
              context respectfully, and follow transparent status updates.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Problem Categories */}
      <section className="border-y border-[#E2E6EC] bg-white/65 backdrop-blur-[2px]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">Civic problem categories</h2>
              <p className="mt-2 text-sm sm:text-base text-[#4B5563]">
                Browse published reports across public infrastructure, utilities, and civic spaces.
              </p>
            </div>
            <Link
              to="/explore"
              className="text-sm font-semibold text-[#0D7A6F] hover:underline whitespace-nowrap"
            >
              Browse all categories →
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REPORT_CATEGORIES.map((category) => (
              <Link
                key={category}
                to={`/explore?category=${encodeURIComponent(category)}`}
                className="flex items-center justify-between rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-4 py-3 text-sm font-medium text-[#0F2942] hover:border-[#0D7A6F] hover:bg-white transition-colors"
              >
                <span className="truncate">{category}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#4B5563] shrink-0 ml-2" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Nearby Community Reporting Concept */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-12 items-center">
          <div className="lg:col-span-6">
            <div className="rounded-xl overflow-hidden border border-[#E2E6EC] bg-white aspect-[4/3]">
              {!commImgErr ? (
                <img
                  src="/src/assets/images/civic_community_illustration_1795508407124.jpg"
                  alt="Illustration of citizens collaborating around a neighborhood civic map"
                  referrerPolicy="no-referrer"
                  onError={() => setCommImgErr(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-6 text-sm text-[#4B5563]">
                  Community neighborhood visibility across Uttarakhand
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 rounded-xl border border-[#E2E6EC] bg-white/85 backdrop-blur-[2px] p-6 sm:p-8">
            <p className="text-xs font-semibold text-[#0D7A6F]">District, Block & Locality Architecture</p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">
              Built for Uttarakhand first, structured for every Indian state
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#374151] leading-relaxed">
              Citizens choose their State, District, Block or Municipality, and Village or Ward. Location permission is
              completely optional—you can select your neighborhood manually without ever sharing precise residential
              coordinates publicly.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-[#374151]">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#0D7A6F] shrink-0 mt-0.5" aria-hidden="true" />
                <span>Covers all 13 districts, 95 official development blocks & villages across Uttarakhand</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#0D7A6F] shrink-0 mt-0.5" aria-hidden="true" />
                <span>Public listings show only generalized block and locality names</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#0D7A6F] shrink-0 mt-0.5" aria-hidden="true" />
                <span>Optional live GPS & Google Maps pin picker shared solely with moderators</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. Transparency & Moderation Explanation */}
      <section className="border-y border-[#E2E6EC] bg-white/65 backdrop-blur-[2px]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-12 items-center">
            <div className="lg:col-span-6 order-2 lg:order-1">
              <p className="text-xs font-semibold text-[#0F2942]">Moderation & Auditability</p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">
                Transparent status history without automated guesswork
              </h2>
              <p className="mt-3 text-sm sm:text-base text-[#374151] leading-relaxed">
                No report is published automatically. Every submission enters a private queue where human moderators
                review safety, duplicate potential, and privacy rules. Every moderation decision records an append-only
                audit entry with a clear reason.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] p-4">
                  <Eye className="w-4 h-4 text-[#0F2942]" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-[#0F2942]">Human Decision Only</p>
                  <p className="mt-1 text-xs text-[#4B5563]">
                    Optional AI tools only flag potential spam or PII; humans approve publication.
                  </p>
                </div>
                <div className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] p-4">
                  <ShieldCheck className="w-4 h-4 text-[#0D7A6F]" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-[#0F2942]">Honest Status Labels</p>
                  <p className="mt-1 text-xs text-[#4B5563]">
                    “Published on जनConnect” means publicly listed here—never “Approved by Government”.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 order-1 lg:order-2">
              <div className="rounded-xl overflow-hidden border border-[#E2E6EC] bg-[#F7F6F2] aspect-[4/3]">
                {!transImgErr ? (
                  <img
                    src="/src/assets/images/civic_transparency_illustration_1795508407696.jpg"
                    alt="Editorial illustration representing transparent civic ledger and moderation review"
                    referrerPolicy="no-referrer"
                    onError={() => setTransImgErr(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-6 text-sm text-[#4B5563]">
                    Human-moderated civic accountability workflow
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Privacy, Safety & Independent Disclaimer */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 space-y-6">
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F2942]">
                <Lock className="w-4 h-4 text-[#0D7A6F]" aria-hidden="true" />
                <span>Privacy & Youth Safety Safeguards</span>
              </div>
              <h2 className="mt-2 font-display text-xl sm:text-2xl font-bold text-[#0F2942]">
                Minimal public data. Zero public exposure of personal details.
              </h2>
              <p className="mt-2 text-sm text-[#4B5563] leading-relaxed">
                Public profiles show only display name, username, optional bio, and general area. Mobile numbers, dates
                of birth, school details, and precise residential coordinates are never shown publicly. All-ages
                production registration remains gated pending adult operator and legal/privacy counsel sign-off.
              </p>
            </div>
            <Link
              to="/safety"
              className="inline-flex items-center justify-center rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-4 py-2.5 text-sm font-semibold text-[#0F2942] hover:bg-white transition-colors whitespace-nowrap shrink-0"
            >
              Visit Safety Centre
            </Link>
          </div>
        </div>

        <IndependentNotice />
      </section>
    </AppShell>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, FileCheck2, ShieldCheck, Upload } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, uploadFormDataWithProgress } from '../../services/api';
import type { ContractorProfile, GovernmentProject } from '../../types/gov';
import { formatInrCurrency } from '../../utils/civicRules';

export function ContractorRegistryPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('contractor');

  const [contractors, setContractors] = useState<ContractorProfile[]>([]);
  const [myProfiles, setMyProfiles] = useState<ContractorProfile[]>([]);
  const [portfolio, setPortfolio] = useState<{
    contractor: ContractorProfile;
    portfolioProjects: Array<GovernmentProject & { awarded_amount_inr: number; award_order_number: string; award_date: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // Registration state
  const [businessName, setBusinessName] = useState('');
  const [authRep, setAuthRep] = useState('');
  const [govtReg, setGovtReg] = useState('');
  const [regAuthority, setRegAuthority] = useState('Uttarakhand PWD');
  const [regClass, setRegClass] = useState('Class A');
  const [certifications, setCertifications] = useState('');
  const [districtCoverage, setDistrictCoverage] = useState('');
  const [prevHistory, setPrevHistory] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRegistry = useCallback(async () => {
    setLoading(true);
    try {
      const pubRes = await apiFetch<{ contractors: ContractorProfile[] }>('/api/public/contractors');
      setContractors(pubRes.contractors);
      if (user) {
        const mineRes = await apiFetch<{ contractors: ContractorProfile[] }>('/api/gov/contractors');
        const owned = mineRes.contractors.filter((c) => c.owner_user_id === user.id);
        setMyProfiles(owned);
        if (owned[0]) {
          setBusinessName(owned[0].registered_business_name);
          setAuthRep(owned[0].authorised_representative);
          setGovtReg(owned[0].govt_registration_number);
          setRegAuthority(owned[0].registration_authority);
          setRegClass(owned[0].registration_class || '');
          setCertifications(owned[0].certifications.join(', '));
          setDistrictCoverage(owned[0].district_coverage || '');
          setPrevHistory(owned[0].previous_project_history || '');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry]);

  useEffect(() => {
    if (!selectedId) {
      setPortfolio(null);
      return;
    }
    apiFetch<{
      contractor: ContractorProfile;
      portfolioProjects: Array<GovernmentProject & { awarded_amount_inr: number; award_order_number: string; award_date: string }>;
    }>(`/api/public/contractors/${selectedId}`)
      .then((res) => setPortfolio(res))
      .catch(() => setPortfolio(null));
  }, [selectedId]);

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('registeredBusinessName', businessName);
      fd.append('authorisedRepresentative', authRep);
      fd.append('govtRegistrationNumber', govtReg);
      fd.append('registrationAuthority', regAuthority);
      fd.append('registrationClass', regClass);
      fd.append('certifications', certifications);
      fd.append('districtCoverage', districtCoverage);
      fd.append('previousProjectHistory', prevHistory);
      if (logoFile) {
        fd.append('logo', logoFile);
      }
      await uploadFormDataWithProgress('/api/gov/contractors', fd, () => {});
      showToast('Contractor profile submitted for government authority verification.', 'success');
      setShowRegisterForm(false);
      await loadRegistry();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-6 border-b border-[#E2E6EC]">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#0D7A6F]">
              Official Contractor Registry & Public Portfolios
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">
              Government-Verified Contractors
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-[#4B5563]">
              Only contractors verified by an authorised government official appear publicly. Bidding on official projects
              takes place exclusively through the government-authorised procurement mechanism.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => setShowRegisterForm((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0D7A6F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0A635A] whitespace-nowrap"
              >
                <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{myProfiles.length > 0 ? 'Update My Contractor Profile' : 'Register Contractor Firm'}</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-[#E2E6EC] bg-white px-4 py-2 text-xs font-semibold text-[#0F2942] hover:bg-[#F7F6F2] whitespace-nowrap"
              >
                <span>Sign In to Register Firm</span>
              </Link>
            )}
          </div>
        </div>

        {/* Own Profile Status Banner if logged in & submitted */}
        {myProfiles[0] && (
          <div className="rounded-xl border border-[#E2E6EC] bg-white p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-semibold text-[#0F2942]">
                Your Registered Contractor Profile: {myProfiles[0].registered_business_name} (
                {myProfiles[0].govt_registration_number})
              </p>
              <p className="text-[#4B5563] mt-0.5">
                Government Verification Status:{' '}
                <strong
                  className={
                    myProfiles[0].verification_status === 'verified'
                      ? 'text-[#0D7A6F]'
                      : myProfiles[0].verification_status === 'suspended'
                      ? 'text-red-700'
                      : 'text-amber-800'
                  }
                >
                  {myProfiles[0].verification_status.toUpperCase()}
                </strong>
              </p>
            </div>
            {myProfiles[0].verification_status === 'verified' && (
              <button
                type="button"
                onClick={() => setSearchParams({ contractor: myProfiles[0].id })}
                className="font-semibold text-[#0D7A6F] hover:underline"
              >
                View My Public Portfolio →
              </button>
            )}
          </div>
        )}

        {/* Contractor Registration / Update Drawer */}
        {showRegisterForm && user && (
          <form onSubmit={handleSubmitProfile} className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#0F2942]">
              Contractor Business Registration (Subject to Government Verification)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[#374151]">
                Registered Business Name *
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                  placeholder="e.g., Garhwal Civil Works Pvt. Ltd."
                />
              </label>
              <label className="block text-xs font-medium text-[#374151]">
                Authorised Representative *
                <input
                  type="text"
                  required
                  value={authRep}
                  onChange={(e) => setAuthRep(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                  placeholder="Full name of authorised signatory"
                />
              </label>
              <label className="block text-xs font-medium text-[#374151]">
                Government Contractor Registration Number *
                <input
                  type="text"
                  required
                  value={govtReg}
                  onChange={(e) => setGovtReg(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
                  placeholder="e.g., UK-PWD-2026-4410"
                />
              </label>
              <label className="block text-xs font-medium text-[#374151]">
                Registration Authority *
                <input
                  type="text"
                  required
                  value={regAuthority}
                  onChange={(e) => setRegAuthority(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                  placeholder="e.g., Uttarakhand PWD / CPWD"
                />
              </label>
              <label className="block text-xs font-medium text-[#374151]">
                Registration Class / Category
                <input
                  type="text"
                  value={regClass}
                  onChange={(e) => setRegClass(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                  placeholder="e.g., Class A Civil & Roads"
                />
              </label>
              <label className="block text-xs font-medium text-[#374151]">
                Certifications (comma-separated)
                <input
                  type="text"
                  value={certifications}
                  onChange={(e) => setCertifications(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                  placeholder="ISO 9001:2015, GST Verified, Hill Road Safety"
                />
              </label>
              <label className="block text-xs font-medium text-[#374151]">
                District Coverage
                <input
                  type="text"
                  value={districtCoverage}
                  onChange={(e) => setDistrictCoverage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                  placeholder="Dehradun, Tehri Garhwal, Haridwar"
                />
              </label>
              <label className="block text-xs font-medium text-[#374151]">
                Company Logo (JPEG / PNG / WebP)
                <div className="mt-1 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#6B7280]" aria-hidden="true" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="text-xs text-[#374151]"
                  />
                </div>
              </label>
            </div>
            <label className="block text-xs font-medium text-[#374151]">
              Previous Public Works History
              <textarea
                rows={3}
                value={prevHistory}
                onChange={(e) => setPrevHistory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                placeholder="Summarize relevant completed government civil, water supply, or drainage works..."
              />
            </label>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRegisterForm(false)}
                className="rounded-lg border border-[#E2E6EC] px-4 py-2 text-xs font-semibold text-[#374151]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#0D7A6F] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit for Government Verification'}
              </button>
            </div>
          </form>
        )}

        {/* Selected Contractor Portfolio */}
        {portfolio && (
          <section className="rounded-xl border border-[#0D7A6F]/40 bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E6EC] pb-4">
              <div className="flex items-start gap-4">
                {portfolio.contractor.logo_url ? (
                  <img
                    src={portfolio.contractor.logo_url}
                    alt={`${portfolio.contractor.registered_business_name} logo`}
                    className="h-14 w-14 rounded-lg border border-[#E2E6EC] object-cover bg-white"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-[#0F2942]" aria-hidden="true" />
                  </div>
                )}
                <div>
                  <p className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D7A6F]">
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    Verified Public Contractor Portfolio
                  </p>
                  <h2 className="font-display text-xl font-bold text-[#0F2942]">
                    {portfolio.contractor.registered_business_name}
                  </h2>
                  <p className="text-xs text-[#4B5563]">
                    Authorised Rep: {portfolio.contractor.authorised_representative} ·{' '}
                    <span className="font-mono">{portfolio.contractor.govt_registration_number}</span> (
                    {portfolio.contractor.registration_authority}
                    {portfolio.contractor.registration_class ? ` · ${portfolio.contractor.registration_class}` : ''})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="text-xs font-semibold text-[#4B5563] underline hover:text-[#0F2942]"
              >
                Close Portfolio
              </button>
            </div>

            {portfolio.contractor.previous_project_history && (
              <p className="text-sm text-[#374151] leading-relaxed">{portfolio.contractor.previous_project_history}</p>
            )}

            <div>
              <h3 className="text-xs font-semibold text-[#0F2942] uppercase tracking-wide mb-3">
                Officially Awarded & Completed JanConnect Projects ({portfolio.portfolioProjects.length})
              </h3>
              {portfolio.portfolioProjects.length === 0 ? (
                <p className="text-sm text-[#4B5563]">No officially awarded projects recorded on JanConnect yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E6EC] text-[#6B7280]">
                        <th className="py-2 pr-3 font-medium">Project</th>
                        <th className="py-2 pr-3 font-medium">Department & Area</th>
                        <th className="py-2 pr-3 font-medium text-right">Sanctioned</th>
                        <th className="py-2 pr-3 font-medium text-right">Awarded</th>
                        <th className="py-2 pr-3 font-medium">Completion</th>
                        <th className="py-2 font-medium text-right">Dossier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E6EC]">
                      {portfolio.portfolioProjects.map((proj) => (
                        <tr key={proj.id}>
                          <td className="py-2.5 pr-3">
                            <p className="font-semibold text-[#0F2942]">{proj.title}</p>
                            <p className="font-mono text-[#6B7280]">
                              {proj.project_code} · Order {proj.award_order_number}
                            </p>
                          </td>
                          <td className="py-2.5 pr-3 text-[#374151]">
                            {proj.department_name} · {proj.generalized_location}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-[#0F2942]">
                            {formatInrCurrency(proj.sanctioned_budget_inr)}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums font-semibold text-[#0D7A6F]">
                            {formatInrCurrency(proj.awarded_amount_inr)}
                          </td>
                          <td className="py-2.5 pr-3 font-mono tabular-nums text-[#374151]">
                            {proj.actual_completion_date || `Exp. ${proj.expected_completion_date}`}
                          </td>
                          <td className="py-2.5 text-right">
                            <Link to={`/projects/${proj.id}`} className="font-semibold text-[#0F2942] underline">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Verified Contractors Directory */}
        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : contractors.length === 0 ? (
          <EmptyState
            title="No government-verified contractors listed yet"
            description="Contractors registered on JanConnect appear publicly only after identity and registration verification by an authorised government official."
            icon={<FileCheck2 className="w-8 h-8 text-[#0F2942]" />}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {contractors.map((c) => (
              <article key={c.id} className="rounded-xl border border-[#E2E6EC] bg-white p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    {c.logo_url ? (
                      <img
                        src={c.logo_url}
                        alt={`${c.registered_business_name} logo`}
                        className="h-11 w-11 rounded-lg border border-[#E2E6EC] object-cover bg-white shrink-0"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-[#0F2942]" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="font-display text-base font-semibold text-[#0F2942] truncate">
                        {c.registered_business_name}
                      </h2>
                      <p className="font-mono text-xs text-[#4B5563] truncate">{c.govt_registration_number}</p>
                    </div>
                  </div>

                  <div className="text-xs text-[#374151] space-y-1">
                    <p>
                      Authorised Rep: <strong>{c.authorised_representative}</strong>
                    </p>
                    <p>
                      Authority: {c.registration_authority}
                      {c.registration_class ? ` · ${c.registration_class}` : ''}
                    </p>
                    {c.district_coverage && <p className="text-[#4B5563]">Coverage: {c.district_coverage}</p>}
                    {c.certifications.length > 0 && (
                      <p className="text-[#4B5563]">Certifications: {c.certifications.join(' · ')}</p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E2E6EC] flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#0D7A6F]">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="font-mono tabular-nums">
                      {c.completed_count ?? 0} Completed · {c.awarded_count ?? 0} Awarded
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchParams({ contractor: c.id })}
                    className="font-semibold text-[#0F2942] hover:text-[#0D7A6F] underline"
                  >
                    Portfolio →
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

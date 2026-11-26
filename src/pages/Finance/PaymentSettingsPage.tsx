import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../services/api';
import type { PaymentGatewaySettings } from '../../types/gov';

export function PaymentSettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<PaymentGatewaySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    providerName: 'Not Configured',
    settlementMode: 'government_agreement_treasury' as 'government_agreement_treasury' | 'future_verified_gateway',
    businessLegalName: '',
    businessAccountLabel: '',
    merchantIdPlaceholder: '',
    webhookEndpointPath: '/api/finance/payments/webhook',
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ settings: PaymentGatewaySettings }>('/api/finance/payment-settings');
      setSettings(res.settings);
      setForm({
        providerName: res.settings.provider_name || 'Not Configured',
        settlementMode: res.settings.settlement_mode || 'government_agreement_treasury',
        businessLegalName: res.settings.business_legal_name || '',
        businessAccountLabel: res.settings.business_account_label || '',
        merchantIdPlaceholder: res.settings.merchant_id_placeholder || '',
        webhookEndpointPath: res.settings.webhook_endpoint_path || '/api/finance/payments/webhook',
      });
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/finance/payment-settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      showToast('Payment placeholder settings saved. Collection remains disabled until server credentials are set.', 'success');
      await loadSettings();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link to="/finance" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F2942] hover:text-[#0D7A6F]">
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to 1% Fee Revenue Dashboard</span>
          </Link>
        </div>

        <div className="pb-4 border-b border-[#E2E6EC]">
          <p className="text-xs font-semibold text-[#0D7A6F]">Payment Architecture (Disabled Placeholder)</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#0F2942]">
            Payment Gateway & Business Account Settings
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#4B5563]">
            Architectural placeholders for future authorised payment provider integration. No live collection, automatic
            deduction, or unverified payment confirmations are permitted.
          </p>
        </div>

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : (
          <>
            {/* Status Banner */}
            <div
              className={`rounded-xl border p-5 flex items-start gap-3 ${
                settings?.gateway_configured_on_server
                  ? 'border-[#0D7A6F]/40 bg-[#0D7A6F]/5 text-[#0F2942]'
                  : 'border-amber-300 bg-amber-50 text-amber-950'
              }`}
            >
              {settings?.gateway_configured_on_server ? (
                <ShieldCheck className="w-5 h-5 text-[#0D7A6F] shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="space-y-1 text-xs">
                <p className="text-sm font-bold">
                  {settings?.gateway_configured_on_server
                    ? 'Payment Gateway Configured on Server'
                    : 'Payment Gateway Not Configured'}
                </p>
                <p className="leading-relaxed">
                  {settings?.gateway_configured_on_server
                    ? 'Server-side credentials are detected. Verified gateway webhooks may confirm settlement against issued invoices.'
                    : 'No payment gateway API credentials or business settlement account are active. Automated payment collection is disabled, no Pay Now button is shown, and payment records cannot be confirmed without verified gateway proof.'}
                </p>
              </div>
            </div>

            {/* Governance Policy */}
            <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-2 text-xs text-[#374151]">
              <h2 className="font-display text-sm font-semibold text-[#0F2942]">
                Government Settlement & Compliance Safeguards
              </h2>
              <ul className="list-disc pl-5 space-y-1 leading-relaxed">
                <li>
                  Government project payments follow the payment mechanism explicitly specified in the government
                  agreement (e.g., state treasury / PFMS or sanctioned invoice).
                </li>
                <li>Public government funds are never automatically routed into a private business account.</li>
                <li>
                  Secret API keys and gateway secrets are never stored in browser code or database rows — they must be
                  supplied only via server environment variables.
                </li>
              </ul>
            </section>

            {/* Placeholder Configuration Form */}
            <form onSubmit={handleSave} className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-[#0F2942]">
                Business Account & Gateway Placeholders
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium text-[#374151]">
                  Payment Provider Placeholder
                  <input
                    type="text"
                    value={form.providerName}
                    onChange={(e) => setForm((f) => ({ ...f, providerName: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                    placeholder="Not Configured (Add provider later)"
                  />
                </label>

                <label className="block text-xs font-medium text-[#374151]">
                  Agreement Settlement Mechanism
                  <select
                    value={form.settlementMode}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        settlementMode: e.target.value as typeof form.settlementMode,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                  >
                    <option value="government_agreement_treasury">Government Agreement Treasury / PFMS</option>
                    <option value="future_verified_gateway">Future Authorised Payment Gateway</option>
                  </select>
                </label>

                <label className="block text-xs font-medium text-[#374151]">
                  Business Legal Entity Placeholder (Optional)
                  <input
                    type="text"
                    value={form.businessLegalName}
                    onChange={(e) => setForm((f) => ({ ...f, businessLegalName: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                    placeholder="To be configured by business owner"
                  />
                </label>

                <label className="block text-xs font-medium text-[#374151]">
                  Business Account Label Placeholder (No Bank Secrets)
                  <input
                    type="text"
                    value={form.businessAccountLabel}
                    onChange={(e) => setForm((f) => ({ ...f, businessAccountLabel: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                    placeholder="e.g., Designated Civic Platform Settlement Account"
                  />
                </label>

                <label className="block text-xs font-medium text-[#374151]">
                  Merchant / Gateway Account ID Placeholder
                  <input
                    type="text"
                    value={form.merchantIdPlaceholder}
                    onChange={(e) => setForm((f) => ({ ...f, merchantIdPlaceholder: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
                    placeholder="To be assigned by payment provider"
                  />
                </label>

                <label className="block text-xs font-medium text-[#374151]">
                  Verification Webhook Path
                  <input
                    type="text"
                    value={form.webhookEndpointPath}
                    onChange={(e) => setForm((f) => ({ ...f, webhookEndpointPath: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
                  />
                </label>
              </div>

              {/* Server Env Var Read-Only Reference */}
              <div className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] p-4 space-y-2 text-xs">
                <p className="font-semibold text-[#0F2942] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#0D7A6F]" aria-hidden="true" />
                  <span>Server-Side API Credentials Placeholders (Environment Variables Only)</span>
                </p>
                <p className="font-mono text-[#374151]">
                  API Key Env Var: <strong>{settings?.api_key_env_var || 'JANCONNECT_PAYMENT_GATEWAY_KEY'}</strong>
                </p>
                <p className="font-mono text-[#374151]">
                  API Secret Env Var:{' '}
                  <strong>{settings?.api_secret_env_var || 'JANCONNECT_PAYMENT_GATEWAY_SECRET'}</strong>
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-[#6B7280]">No Pay Now or automatic collection is enabled.</span>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#0F2942] px-5 py-2 text-xs font-semibold text-white hover:bg-[#163A5C] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Placeholder Configuration'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}

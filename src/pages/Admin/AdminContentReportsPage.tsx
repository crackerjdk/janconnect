import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { apiFetch } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface FlagRow {
  id: string;
  reporter_username: string;
  target_type: 'complaint' | 'comment' | 'user';
  target_id: string;
  reason: string;
  review_status: 'pending' | 'resolved_removed' | 'dismissed';
  created_at: string;
}

interface ManagedUserRow {
  id: string;
  username: string;
  display_name: string;
  account_status: 'active' | 'restricted' | 'suspended';
  identity_status: string;
  created_at: string;
}

export function AdminContentReportsPage() {
  const { showToast } = useToast();
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [users, setUsers] = useState<ManagedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmFlag, setConfirmFlag] = useState<{ id: string; decision: 'dismiss' | 'remove_target' } | null>(null);
  const [confirmUser, setConfirmUser] = useState<{ id: string; status: 'active' | 'restricted' | 'suspended' } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ flags: FlagRow[]; users: ManagedUserRow[] }>('/api/admin/content-reports');
      setFlags(res.flags);
      setUsers(res.users);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleResolveFlag = async () => {
    if (!confirmFlag) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/content-reports/${confirmFlag.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ decision: confirmFlag.decision, reason: 'Moderator safety review decision' }),
      });
      showToast('Safety flag updated.', 'success');
      setConfirmFlag(null);
      await load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!confirmUser) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/users/${confirmUser.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: confirmUser.status, reason: 'Moderator account review' }),
      });
      showToast('Account status updated.', 'success');
      setConfirmUser(null);
      await load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0F2942] hover:underline">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Moderator Console</span>
        </Link>

        <h1 className="font-display text-2xl font-bold text-[#0F2942]">Reported Content & Account Safety</h1>

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <section className="lg:col-span-7 rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
              <h2 className="font-display text-base font-semibold text-[#0F2942]">
                Community Safety Flags ({flags.length})
              </h2>
              {flags.length === 0 ? (
                <EmptyState
                  title="No reported content flags"
                  description="When community members report unsafe comments or listings, they appear here for review."
                />
              ) : (
                <ul className="divide-y divide-[#E2E6EC]">
                  {flags.map((f) => (
                    <li key={f.id} className="py-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#0F2942]">
                          Target: {f.target_type} · Flagged by @{f.reporter_username}
                        </span>
                        <span className="font-mono text-[#4B5563]">{f.review_status}</span>
                      </div>
                      <p className="text-sm text-[#374151]">{f.reason}</p>
                      {f.review_status === 'pending' && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setConfirmFlag({ id: f.id, decision: 'remove_target' })}
                            className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white"
                          >
                            Remove / Restrict Target
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmFlag({ id: f.id, decision: 'dismiss' })}
                            className="rounded-md border border-[#E2E6EC] px-3 py-1.5 text-xs font-medium text-[#374151]"
                          >
                            Dismiss Flag
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="lg:col-span-5 rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
              <h2 className="font-display text-base font-semibold text-[#0F2942]">Registered Citizen Accounts</h2>
              {users.length === 0 ? (
                <p className="text-xs text-[#6B7280]">No citizen accounts registered yet.</p>
              ) : (
                <ul className="divide-y divide-[#E2E6EC] text-xs">
                  {users.map((u) => (
                    <li key={u.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0F2942]">
                          {u.display_name} (@{u.username})
                        </p>
                        <p className="text-[#6B7280]">
                          Status: {u.account_status} · Verify: {u.identity_status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.account_status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => setConfirmUser({ id: u.id, status: 'restricted' })}
                            className="rounded border border-red-200 px-2.5 py-1 text-red-700 hover:bg-red-50"
                          >
                            Restrict
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmUser({ id: u.id, status: 'active' })}
                            className="rounded border border-[#E2E6EC] px-2.5 py-1 text-[#0D7A6F]"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <ConfirmDialog
          open={confirmFlag !== null}
          title="Confirm Safety Review Action"
          description={
            confirmFlag?.decision === 'remove_target'
              ? 'This will remove the flagged content or restrict the target account and log an audit entry.'
              : 'This will dismiss the safety flag.'
          }
          confirmLabel={confirmFlag?.decision === 'remove_target' ? 'Confirm Removal' : 'Dismiss Flag'}
          destructive={confirmFlag?.decision === 'remove_target'}
          loading={busy}
          onConfirm={handleResolveFlag}
          onCancel={() => setConfirmFlag(null)}
        />

        <ConfirmDialog
          open={confirmUser !== null}
          title="Update Account Status"
          description={`Change this user's account status to "${confirmUser?.status}" and send an in-app safety notification?`}
          confirmLabel="Confirm Status Change"
          destructive={confirmUser?.status !== 'active'}
          loading={busy}
          onConfirm={handleUpdateUser}
          onCancel={() => setConfirmUser(null)}
        />
      </div>
    </AppShell>
  );
}

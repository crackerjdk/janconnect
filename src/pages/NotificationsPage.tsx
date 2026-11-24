import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { apiFetch } from '../services/api';
import type { NotificationItem } from '../types/civic';

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiFetch<{ notifications: NotificationItem[] }>('/api/notifications')
      .then((res) => setItems(res.notifications))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
  };

  const markAllRead = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    setItems((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#0F2942]">Notifications</h1>
            <p className="text-sm text-[#4B5563]">Moderation updates, comments, and safety notices.</p>
          </div>
          {items.some((i) => !i.is_read) && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E6EC] bg-white px-3 py-1.5 text-xs font-medium text-[#0F2942] hover:bg-[#F7F6F2]"
            >
              <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-6 h-6" />}
            title="No notifications yet"
            description="You will be notified here when a moderator reviews your report or someone comments on your published submission."
          />
        ) : (
          <ul className="divide-y divide-[#E2E6EC] rounded-xl border border-[#E2E6EC] bg-white">
            {items.map((n) => (
              <li
                key={n.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                  n.is_read ? 'bg-white' : 'bg-[#F0EFEA]/60'
                }`}
              >
                <div className="space-y-1">
                  <p className={`text-sm ${n.is_read ? 'text-[#4B5563]' : 'font-semibold text-[#0F2942]'}`}>
                    {n.message}
                  </p>
                  <p className="font-mono text-xs text-[#6B7280] tabular-nums">
                    {new Date(n.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {n.related_id && (
                    <Link
                      to={n.type === 'report_published' || n.type === 'new_comment' ? `/reports/${n.related_id}` : '/my-reports'}
                      className="text-xs font-semibold text-[#0D7A6F] hover:underline whitespace-nowrap"
                    >
                      Open
                    </Link>
                  )}
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="text-xs font-medium text-[#0F2942] hover:underline whitespace-nowrap"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

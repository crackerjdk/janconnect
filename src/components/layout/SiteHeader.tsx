import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandName } from '../ui/BrandName';

export function SiteHeader() {
  const { user, isModerator, isGovernmentAuthority, isFinancialAdmin } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`));

  const navItems = user
    ? [
        { label: 'Explore', to: '/explore' },
        { label: 'Public Projects', to: '/projects' },
        { label: 'Contractors', to: '/contractor-registry' },
        { label: 'My Reports', to: '/my-reports' },
        ...(isGovernmentAuthority ? [{ label: 'Gov Console', to: '/gov' }] : []),
        ...(isFinancialAdmin ? [{ label: '1% Fee', to: '/finance' }] : []),
        ...(isModerator
          ? [{ label: 'Moderator', to: '/admin' }]
          : !isGovernmentAuthority && !isFinancialAdmin
          ? [{ label: 'Profile', to: `/profile/${user.username}` }]
          : []),
      ]
    : [
        { label: 'Explore', to: '/explore' },
        { label: 'Public Projects', to: '/projects' },
        { label: 'Contractors', to: '/contractor-registry' },
        { label: 'Bids', to: '/contractors' },
        { label: 'Sign In', to: '/login' },
        { label: 'Moderator', to: '/admin/login' },
      ];

  const primaryCta = user
    ? { label: 'Report a Problem', to: '/reports/create' }
    : { label: 'Report a Problem', to: '/signup' };

  return (
    <header className="sticky top-0 z-40 border-b border-[#E2E6EC] bg-[#FFFFFF]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        {/* Zone 1: Clean brand wordmark + colorful Uttarakhand map */}
        <Link
          to="/"
          aria-label="जनConnect Home"
          className="font-display text-lg font-bold tracking-tight text-[#0F2942] whitespace-nowrap shrink-0"
        >
          <BrandName accent showMap />
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav aria-label="Primary" className="hidden md:flex items-center gap-5 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#0F2942] ${
                isActive(item.to)
                  ? 'text-[#0F2942] underline underline-offset-4 decoration-2 decoration-[#0D7A6F]'
                  : 'text-[#4B5563]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Zone 3: Single primary action + mobile menu trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to={primaryCta.to}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-[#0D7A6F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0A635A] transition-colors whitespace-nowrap shrink-0"
          >
            {primaryCta.label}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E6EC] text-[#0F2942]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden border-t border-[#E2E6EC] bg-white px-4 py-3 space-y-1"
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#111827] hover:bg-[#F7F6F2]"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/contractors"
            onClick={() => setMobileOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#111827] hover:bg-[#F7F6F2]"
          >
            Community Contractor Bids
          </Link>
          {user && (
            <>
              <Link
                to="/home"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#111827] hover:bg-[#F7F6F2]"
              >
                Citizen Home
              </Link>
              <Link
                to="/notifications"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#111827] hover:bg-[#F7F6F2]"
              >
                Notifications
              </Link>
              <Link
                to="/settings"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#111827] hover:bg-[#F7F6F2]"
              >
                Settings
              </Link>
            </>
          )}
          <div className="pt-2">
            <Link
              to={primaryCta.to}
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center rounded-lg bg-[#0D7A6F] px-4 py-2.5 text-sm font-semibold text-white"
            >
              {primaryCta.label}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

import { Link } from 'react-router-dom';
import { BrandName } from '../ui/BrandName';

export function SiteFooter() {
  return (
    <footer className="border-t border-[#E2E6EC] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="font-display text-base font-bold text-[#0F2942]">
              <BrandName accent showMap />
            </p>
            <p className="mt-2 max-w-md text-sm text-[#4B5563] leading-relaxed">
              Your Voice. Your State. Your Accountability. An independent civic reporting and community visibility
              platform launching in Uttarakhand, India.
            </p>
            <p className="mt-3 text-xs text-[#6B7280] leading-relaxed">
              जनConnect is not an official government portal and does not forward reports automatically to government
              departments.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[#0F2942]">Platform & Projects</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#4B5563]">
              <li>
                <Link to="/explore" className="hover:text-[#0F2942]">
                  Explore Reports
                </Link>
              </li>
              <li>
                <Link to="/projects" className="hover:text-[#0F2942]">
                  Public Project Transparency
                </Link>
              </li>
              <li>
                <Link to="/contractor-registry" className="hover:text-[#0F2942]">
                  Contractor Registry & Portfolios
                </Link>
              </li>
              <li>
                <Link to="/contractors" className="hover:text-[#0F2942]">
                  Community Contractor Bids
                </Link>
              </li>
              <li>
                <Link to="/reports/create" className="hover:text-[#0F2942]">
                  Report a Problem
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[#0F2942]">Governance & Trust</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#4B5563]">
              <li>
                <Link to="/gov" className="hover:text-[#0F2942]">
                  Government Authority Console
                </Link>
              </li>
              <li>
                <Link to="/finance" className="hover:text-[#0F2942]">
                  1% Facilitation Fee Dashboard
                </Link>
              </li>
              <li>
                <Link to="/finance/payment-settings" className="hover:text-[#0F2942]">
                  Payment Gateway Settings
                </Link>
              </li>
              <li>
                <Link to="/admin/login" className="hover:text-[#0F2942]">
                  Moderator Access
                </Link>
              </li>
              <li>
                <Link to="/safety" className="hover:text-[#0F2942]">
                  Safety Centre & Disclaimers
                </Link>
              </li>
              <li>
                <span className="text-xs text-[#6B7280]">Help Desk: safety@janconnect.example</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-[#E2E6EC] pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#6B7280]">
          <span>जनConnect V0.1 · Independent Civic Platform</span>
          <span>Initial Geography: Uttarakhand, India</span>
        </div>
      </div>
    </footer>
  );
}

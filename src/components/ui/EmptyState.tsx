import React from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, actionLabel, actionTo, onAction, icon }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-[#E2E6EC] bg-white px-6 py-12 text-center">
      {icon && <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-[#4B5563]">{icon}</div>}
      <h3 className="font-display text-base font-semibold text-[#0F2942]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[#4B5563] leading-relaxed">{description}</p>
      {actionLabel && actionTo && (
        <div className="mt-5">
          <Link
            to={actionTo}
            className="inline-flex items-center justify-center rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-medium text-white hover:bg-[#163A5C] transition-colors whitespace-nowrap"
          >
            {actionLabel}
          </Link>
        </div>
      )}
      {actionLabel && onAction && !actionTo && (
        <div className="mt-5">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center justify-center rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-medium text-white hover:bg-[#163A5C] transition-colors whitespace-nowrap"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

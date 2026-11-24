import React, { createContext, useContext, useState } from 'react';

export interface ReportDraftState {
  title: string;
  description: string;
  category: string;
  stateId: string;
  districtId: string;
  blockId: string;
  localityId: string;
  generalizedLocationLabel: string;
  approximateLat: string;
  approximateLng: string;
  suggestedMapCenter: { lat: number; lng: number } | null;
  urgencyNote: string;
  files: File[];
}

const initialDraft: ReportDraftState = {
  title: '',
  description: '',
  category: 'Roads and Transportation',
  stateId: 'uk-state',
  districtId: '',
  blockId: '',
  localityId: '',
  generalizedLocationLabel: '',
  approximateLat: '',
  approximateLng: '',
  suggestedMapCenter: null,
  urgencyNote: '',
  files: [],
};

interface ReportDraftContextValue {
  draft: ReportDraftState;
  setDraft: React.Dispatch<React.SetStateAction<ReportDraftState>>;
  resetDraft: () => void;
}

const ReportDraftContext = createContext<ReportDraftContextValue | null>(null);

export function ReportDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<ReportDraftState>(initialDraft);

  const resetDraft = () => setDraft(initialDraft);

  return (
    <ReportDraftContext.Provider value={{ draft, setDraft, resetDraft }}>
      {children}
    </ReportDraftContext.Provider>
  );
}

export function useReportDraft(): ReportDraftContextValue {
  const ctx = useContext(ReportDraftContext);
  if (!ctx) throw new Error('useReportDraft must be used inside ReportDraftProvider');
  return ctx;
}

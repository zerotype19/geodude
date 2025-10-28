// Centralized thresholds for render visibility scoring
// Aligned with 2025 SEO + LLM research

export const RENDER_VISIBILITY = {
  bands: {
    strong: 0.7,    // ≥70% content in static HTML
    moderate: 0.5,  // 50-70% content in static HTML
    weak: 0.3       // 30-50% content in static HTML
    // < 30% = Poor
  },
  sitePenalty: {
    AEO: { threshold: 0.3, penalty: -5 },  // apply only if avg < 0.30
    GEO: { threshold: 0.5, penalty: -10 }  // apply if avg < 0.50 (stricter for LLMs)
  }
};

// Helper for display labels in Evidence UI
export function renderParityLabel(ratio: number): { 
  icon: JSX.Element; 
  label: string; 
  hint: string;
  severity: 'success' | 'warning' | 'error';
} {
  if (ratio >= 0.9) {
    return { 
      icon: (
        <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ),
      label: 'High parity', 
      hint: '≥90% of content present in server HTML',
      severity: 'success'
    };
  }
  if (ratio >= 0.5) {
    return { 
      icon: (
        <svg className="w-5 h-5 text-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      label: 'Partial parity', 
      hint: '50–90% present - consider server-rendering key blocks',
      severity: 'warning'
    };
  }
  return { 
    icon: (
      <svg className="w-5 h-5 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    ),
    label: 'Low parity', 
    hint: '<50% present - LLM crawlers likely miss key content',
    severity: 'error'
  };
}

// Helper for A11 score band labels
export function getBandFromRatio(ratio: number): string {
  if (ratio >= RENDER_VISIBILITY.bands.strong) return 'Strong';
  if (ratio >= RENDER_VISIBILITY.bands.moderate) return 'Moderate';
  if (ratio >= RENDER_VISIBILITY.bands.weak) return 'Weak';
  return 'Poor';
}

// Helper for score badge colors
export function getBandColor(band: string): string {
  switch (band) {
    case 'Strong': return 'bg-success-soft text-success';
    case 'Moderate': return 'bg-warn-soft text-warn';
    case 'Weak': return 'bg-orange-100 text-orange-800';
    case 'Poor': return 'bg-danger-soft text-danger';
    default: return 'bg-surface-2 text-gray-800';
  }
}


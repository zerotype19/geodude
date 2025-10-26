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
  emoji: string; 
  label: string; 
  hint: string;
  severity: 'success' | 'warning' | 'error';
} {
  if (ratio >= 0.9) {
    return { 
      emoji: '', 
      label: 'High parity', 
      hint: '≥90% of content present in server HTML',
      severity: 'success'
    };
  }
  if (ratio >= 0.5) {
    return { 
      emoji: '️', 
      label: 'Partial parity', 
      hint: '50–90% present - consider server-rendering key blocks',
      severity: 'warning'
    };
  }
  return { 
    emoji: '', 
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


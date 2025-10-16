import { Link, useLocation } from "react-router-dom";
import { useState, useMemo } from "react";
import type { AuditIssue } from "../services/api";
import { b64u } from "../services/api";

function badge(sev: string) {
  const s = sev.toLowerCase();
  if (s.startsWith("crit")) {
    return <span className="pill high">{sev}</span>;
  }
  if (s.startsWith("warn")) {
    return <span className="pill warn">{sev}</span>;
  }
  return <span className="pill info">{sev}</span>;
}

function formatUrl(url?: string) {
  if (!url) return "-";
  try {
    const u = new URL(url);
    return u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

type FilterState = {
  v21Only: boolean;
  hideDuplicates: boolean;
  category: string | null;
};

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        padding: '4px 12px',
        fontSize: 12,
        borderRadius: 16,
        border: '1px solid #d1d5db',
        background: value ? '#3b82f6' : 'white',
        color: value ? 'white' : '#374151',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      {label}
    </button>
  );
}

function CategorySelect({ value, onChange, options }: { value: string | null; onChange: (v: string | null) => void; options: string[] }) {
  return (
    <select
      value={value || 'All'}
      onChange={(e) => onChange(e.target.value === 'All' ? null : e.target.value)}
      style={{
        padding: '4px 8px',
        fontSize: 12,
        borderRadius: 6,
        border: '1px solid #d1d5db',
        background: 'white',
        color: '#374151'
      }}
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

export default function IssuesTable({ issues }: { issues: AuditIssue[] }) {
  const location = useLocation();
  const [filters, setFilters] = useState<FilterState>({
    v21Only: false,
    hideDuplicates: false,
    category: null
  });

  // Extract audit ID from path: /a/:auditId or /a/:auditId/p/:encoded
  const auditId = location.pathname.split('/')[2] || '';

  const filteredIssues = useMemo(() => {
    let filtered = issues || [];
    
    if (filters.v21Only) {
      filtered = filtered.filter(issue => issue.issue_rule_version === 'v2.1');
    }
    
    if (filters.category) {
      filtered = filtered.filter(issue => issue.category.toLowerCase() === filters.category?.toLowerCase());
    }
    
    if (filters.hideDuplicates) {
      const seen = new Set();
      filtered = filtered.filter(issue => {
        const key = `${issue.category}-${issue.message}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    
    return filtered;
  }, [issues, filters]);

  if (!issues?.length) return <div>No issues 🎉</div>;
  
  const categories = [...new Set(issues.map(i => i.category))];
  
  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Toggle 
          value={filters.v21Only} 
          onChange={(v) => setFilters(prev => ({ ...prev, v21Only: v }))} 
          label="v2.1 only" 
        />
        <Toggle 
          value={filters.hideDuplicates} 
          onChange={(v) => setFilters(prev => ({ ...prev, hideDuplicates: v }))} 
          label="Hide duplicates" 
        />
        <CategorySelect 
          value={filters.category} 
          onChange={(v) => setFilters(prev => ({ ...prev, category: v }))} 
          options={['All', ...categories]} 
        />
      </div>

      <table style={{ width: "100%", fontSize: "14px" }}>
        <thead>
          <tr>
            <th style={{ width: "100px" }}>Severity</th>
            <th style={{ width: "120px" }}>Category</th>
            <th>Message</th>
            <th style={{ width: "80px" }}>Rule</th>
            <th style={{ width: "250px" }}>Page</th>
          </tr>
        </thead>
        <tbody>
          {filteredIssues.map((i, idx) => (
            <tr key={idx}>
              <td>{badge(i.severity)}</td>
              <td style={{ textTransform: "capitalize" }}>{i.category}</td>
              <td>{i.message}</td>
              <td style={{ fontSize: 12, color: '#6b7280' }}>
                {i.issue_rule_version ?? "v1.0"}
              </td>
              <td style={{ fontSize: "12px", wordBreak: "break-all" }}>
                {i.url && auditId ? (
                  <Link
                    to={`/a/${auditId}/p/${b64u.enc(i.url)}`}
                    title={i.url}
                    style={{ color: "#667eea" }}
                  >
                    {formatUrl(i.url)}
                  </Link>
                ) : (
                  <span style={{ color: "#999" }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {filteredIssues.length === 0 && issues.length > 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
          No issues match the current filters
        </div>
      )}
    </div>
  );
}


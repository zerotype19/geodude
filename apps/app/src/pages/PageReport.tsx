import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAuditPage, b64u } from '../services/api';
import IssuesTable from '../components/IssuesTable';

export default function PageReport() {
  const { auditId = '', encoded = '' } = useParams();
  const target = useMemo(() => {
    try {
      return b64u.dec(encoded);
    } catch {
      return '';
    }
  }, [encoded]);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setErr('Invalid page URL');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);
    getAuditPage(auditId, target)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [auditId, target]);

  if (loading) return <div style={{padding: '40px', textAlign: 'center'}}>Loading page report…</div>;
  if (err) return <div style={{padding: '40px', textAlign: 'center', color: '#ef4444'}}>Error: {err}</div>;
  if (!data) return null;

  const p = data.page;
  
  const badge = (ok: boolean, label: string) => (
    <span style={{
      padding: '4px 8px',
      borderRadius: 12,
      marginRight: 8,
      background: ok ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
      color: ok ? 'rgb(16,185,129)' : 'rgb(239,68,68)',
      fontSize: 12,
      fontWeight: 600
    }}>
      {label}{ok ? ' ✓' : ' ✕'}
    </span>
  );

  const formatUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.pathname + u.search + u.hash;
    } catch {
      return url;
    }
  };

  const short = formatUrl(p.url);

  return (
    <div style={{ maxWidth: 1060, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <Link to={`/a/${auditId}`}>← Back to Audit</Link>
        <div style={{ opacity: 0.5 }}>•</div>
        <a href={p.url} target="_blank" rel="noreferrer" style={{ color: '#667eea' }}>
          {short}
        </a>
      </div>

      <h1 style={{ margin: '8px 0 6px', fontSize: '32px' }}>Page Report</h1>
      <div style={{ opacity: 0.7, marginBottom: 16 }}>
        {p.title || 'Untitled'} — {p.status || '-'} status
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 12,
        marginBottom: 16
      }}>
        <div style={{
          padding: '16px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          background: 'white'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Word Count</div>
          <div style={{ fontSize: '24px', fontWeight: '600' }}>{p.word_count ?? '—'}</div>
        </div>
        <div style={{
          padding: '16px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          background: 'white'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Has H1</div>
          <div style={{ fontSize: '24px', fontWeight: '600' }}>{p.has_h1 ? 'Yes' : 'No'}</div>
        </div>
        <div style={{
          padding: '16px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          background: 'white'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>JSON-LD</div>
          <div style={{ fontSize: '24px', fontWeight: '600' }}>{p.json_ld_count ?? 0}</div>
        </div>
        <div style={{
          padding: '16px',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          background: 'white'
        }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>FAQ Present</div>
          <div style={{ fontSize: '24px', fontWeight: '600' }}>{p.faq_present ? 'Yes' : 'No'}</div>
        </div>
      </div>

      <div style={{ margin: '12px 0 24px' }}>
        {badge(p.score_hints.word_ok, 'Content ≥120 words')}
        {badge(p.score_hints.has_h1, 'H1 present')}
        {badge(p.score_hints.has_json_ld, 'JSON-LD present')}
        {badge(p.score_hints.faq_ok, 'FAQ present')}
      </div>

      <h2 style={{ margin: '16px 0', fontSize: '24px' }}>
        Issues on this page ({data.issues.length})
      </h2>
      {data.issues.length > 0 ? (
        <IssuesTable issues={data.issues} />
      ) : (
        <div style={{ padding: '24px', textAlign: 'center', color: '#10b981' }}>
          No issues found on this page! 🎉
        </div>
      )}
    </div>
  );
}


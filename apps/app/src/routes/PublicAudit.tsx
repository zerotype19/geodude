import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getAudit, rerunAudit, type Audit } from "../services/api";
import ScoreCard from "../components/ScoreCard";
import IssuesTable from "../components/IssuesTable";
import PagesTable from "../components/PagesTable";
import EntityRecommendations from "../components/EntityRecommendations";
import Citations from "../components/Citations";
import BraveQueriesModal from "../components/BraveQueriesModal";
import { getBotMeta } from "../lib/botMeta";

export default function PublicAudit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scores' | 'issues' | 'pages' | 'citations'>('scores');
  const [rerunning, setRerunning] = useState(false);
  const [showBraveModal, setShowBraveModal] = useState(false);
  
  const hasApiKey = useMemo(() => !!localStorage.getItem('ov_api_key'), []);

  // Read tab from URL on mount and when URL changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'citations' || tabParam === 'scores' || tabParam === 'issues' || tabParam === 'pages') {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  useEffect(() => {
    (async () => {
      try { 
        if (id) setAudit(await getAudit(id)); 
      } catch (e: any) { 
        setError(e?.message || "Failed to load"); 
      }
    })();
  }, [id]);

  async function handleRerun() {
    if (!id) return;
    try {
      setRerunning(true);
      const result = await rerunAudit(id);
      
      // Show success message before navigating
      const newAuditUrl = `/a/${result.id}`;
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 9999;
        font-size: 14px;
        max-width: 400px;
        cursor: pointer;
      `;
      notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">✓ New audit started!</div>
            <div style="opacity: 0.9;">Redirecting to audit ${result.id}...</div>
          </div>
          <button style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; margin-left: 12px; line-height: 1;">×</button>
        </div>
      `;
      notification.onclick = () => notification.remove();
      document.body.appendChild(notification);
      
      // Navigate after brief delay to show notification
      setTimeout(() => {
        setRerunning(false); // Reset state before navigation
        notification.remove(); // Remove notification
        navigate(newAuditUrl);
      }, 800);
    } catch (e: any) {
      const isRateLimit = e?.message?.includes('Rate limit') || e?.message?.includes('429');
      const message = isRateLimit 
        ? 'Daily audit budget reached. Try again after 00:00 UTC.'
        : e?.message || 'Re-run failed';
      
      // Show error notification
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 9999;
        font-size: 14px;
        max-width: 400px;
        cursor: pointer;
      `;
      notification.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">✕ Re-run Failed</div>
        <div style="opacity: 0.9;">${message}</div>
        <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">Click to dismiss</div>
      `;
      notification.onclick = () => {
        notification.remove();
        setRerunning(false); // Ensure state is reset when dismissed
      };
      document.body.appendChild(notification);
      
      // Auto-dismiss after 5 seconds and reset state
      setTimeout(() => {
        notification.remove();
        setRerunning(false);
      }, 5000);
    } finally {
      // Ensure state is always reset
      setRerunning(false);
    }
  }

  if (error) return <div className="card">{error}</div>;
  if (!audit) return <div className="card">Loading…</div>;

  return (
    <>
      {/* Header with Re-run button */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 16 
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Audit Report</h1>
          {audit.property ? (
            <p style={{ margin: '4px 0 0', fontSize: 14, opacity: 0.7 }}>
              <span style={{ fontWeight: 500 }}>{audit.property.name}</span>
              {audit.property.name !== audit.property.domain && (
                <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>
                  {audit.property.domain}
                </span>
              )}
            </p>
          ) : audit.domain && (
            <p style={{ margin: '4px 0 0', fontSize: 14, opacity: 0.7 }}>
              {audit.domain}
            </p>
          )}
        </div>
        {hasApiKey && (
          <button
            onClick={handleRerun}
            disabled={rerunning}
            style={{
              padding: '8px 16px',
              background: rerunning ? '#64748b' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: rerunning ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
            title="Start a fresh audit for this property"
          >
            {rerunning ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span>Re-running…</span>
                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                <span>Re-run Audit</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Critical AI Bot Blocking Alert */}
      {audit.site?.flags?.aiBlocked && (
        <div style={{
          background: '#fee2e2',
          border: '2px solid #ef4444',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
            <div style={{ fontSize: 24 }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 8px', color: '#991b1b', fontSize: 18, fontWeight: 600 }}>
                AI Crawlers Are Blocked
              </h3>
              <p style={{ margin: '0 0 12px', color: '#7f1d1d', fontSize: 14, lineHeight: 1.6 }}>
                {audit.site.flags.blockedBy === 'robots'
                  ? 'Your robots.txt is blocking AI bots. This prevents AI assistants from discovering and citing your content.'
                  : audit.site.flags.blockedBy === 'waf'
                    ? `Your ${audit.site.flags.wafName || 'CDN/WAF'} is blocking AI bots. This prevents AI assistants from accessing your content.`
                    : 'AI bots cannot reach your site. This prevents AI assistants from discovering and citing your content.'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: '#991b1b', fontWeight: 500 }}>
                  Blocked bots: {audit.site.flags.blockedBots.join(', ')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a
                  href={`https://www.google.com/search?q=how+to+allow+${audit.site.flags.blockedBy === 'robots' ? 'AI+bots+in+robots.txt' : audit.site.flags.wafName + '+AI+bots'}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '8px 16px',
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: 6,
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: 500,
                    display: 'inline-block',
                  }}
                >
                  {audit.site.flags.blockedBy === 'robots' ? 'Fix robots.txt' : `Configure ${audit.site.flags.wafName || 'WAF'}`}
                </a>
                <a
                  href={`/v1/debug/ai-access/${audit.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '8px 16px',
                    background: 'white',
                    color: '#991b1b',
                    border: '1px solid #fca5a5',
                    borderRadius: 6,
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: 500,
                    display: 'inline-block',
                  }}
                >
                  View Debug Info
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="row">
        <ScoreCard title="Overall" value={audit.scores.total}/>
        
        <div style={{ flex: 1 }}>
          <ScoreCard title="Crawlability" value={audit.scores.crawlability}/>
          {audit.scores.breakdown?.crawlability && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 12,
                background: audit.scores.breakdown.crawlability.robotsTxtFound ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                color: audit.scores.breakdown.crawlability.robotsTxtFound ? '#10b981' : '#ef4444',
              }}>
                robots.txt {audit.scores.breakdown.crawlability.robotsTxtFound ? '✓' : '✗'}
              </span>
              <span style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 12,
                background: audit.scores.breakdown.crawlability.sitemapOk ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                color: audit.scores.breakdown.crawlability.sitemapOk ? '#10b981' : '#ef4444',
              }}>
                sitemap {audit.scores.breakdown.crawlability.sitemapOk ? '✓' : '✗'}
              </span>
              <span style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 12,
                background: 'rgba(100,116,139,.15)',
                color: '#64748b',
              }} title="AI bots allowed">
                AI bots: {Object.values(audit.scores.breakdown.crawlability.aiBots).filter(Boolean).length}/{Object.keys(audit.scores.breakdown.crawlability.aiBots).length}
              </span>
            </div>
          )}
          
          {/* AI Bot Access Probe Results */}
          {audit.site?.aiAccess && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 12,
                background: audit.site.aiAccess.summary.blocked > 0 ? 'rgba(239,68,68,.2)' : 'rgba(16,185,129,.2)',
                color: audit.site.aiAccess.summary.blocked > 0 ? '#ef4444' : '#10b981',
              }} title={`${audit.site.aiAccess.summary.blocked} blocked bots detected`}>
                AI Access: {audit.site.aiAccess.summary.allowed}/{audit.site.aiAccess.summary.tested} {audit.site.aiAccess.summary.blocked > 0 ? '⚠' : '✓'}
              </span>
              {audit.site.aiAccess.summary.waf && (
                <span style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 12,
                  background: 'rgba(251,191,36,.2)',
                  color: '#fbbf24',
                }} title="CDN/WAF detected">
                  {audit.site.aiAccess.summary.waf}
                </span>
              )}
              {/* Per-bot status badges */}
              {Object.entries(audit.site.aiAccess.results).slice(0, 7).map(([bot, r]) => (
                <span 
                  key={bot} 
                  title={`${bot}: ${r.status}${r.server ? ` (${r.server})` : ''}`}
                  style={{
                    fontSize: 10,
                    padding: '3px 6px',
                    borderRadius: 8,
                    background: r.ok ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                    color: r.ok ? '#10b981' : '#ef4444',
                  }}
                >
                  {bot}: {r.status}
                </span>
              ))}
            </div>
          )}
          
          {/* Phase G: Real AI crawler traffic (30d) */}
          {audit.site?.crawlers && audit.site.crawlers.total > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
              <strong style={{ color: '#10b981' }}>AI Bot Traffic (30d):</strong>{' '}
              {Object.entries(audit.site.crawlers.byBot)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([bot, n]) => {
                  const meta = getBotMeta(bot);
                  return (
                    <span key={bot} title={`${meta.label} (${meta.org})`}>
                      {meta.icon} {meta.label}:{n}
                    </span>
                  );
                })
                .reduce((acc, curr, idx) => idx === 0 ? [curr] : [...acc, ' • ', curr], [] as any[])}
              {Object.keys(audit.site.crawlers.byBot).length > 4 && ' • …'}
            </div>
          )}
          
          {/* Phase F+: Brave AI Queries Chip */}
          {audit.site?.braveAI && (audit.site.braveAI.queriesTotal ?? 0) > 0 && (
            <button
              onClick={() => setShowBraveModal(true)}
              style={{
                marginTop: 8,
                fontSize: 11,
                padding: '6px 12px',
                borderRadius: 12,
                background: 'rgba(139,92,246,.15)',
                color: '#8b5cf6',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139,92,246,.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(139,92,246,.15)';
              }}
              title={`Brave AI: ${audit.site.braveAI.resultsTotal ?? 0}/${audit.site.braveAI.queriesTotal ?? 0} queries with results${
                audit.site.braveAI.diagnostics
                  ? `\n\nBreakdown:\n• ${audit.site.braveAI.diagnostics.ok} OK\n• ${audit.site.braveAI.diagnostics.empty} No Answer\n• ${audit.site.braveAI.diagnostics.rate_limited} Rate-Limited\n• ${audit.site.braveAI.diagnostics.error} Error\n• ${audit.site.braveAI.diagnostics.timeout} Timeout${
                      audit.site.braveAI.querySamples && audit.site.braveAI.querySamples.length > 0
                        ? `\n\nSample queries:\n${audit.site.braveAI.querySamples.slice(0, 5).map(q => `• ${q}`).join('\n')}`
                        : ''
                    }`
                  : ''
              }`}
            >
              <span>🤖 Brave AI:</span>
              <span style={{ fontWeight: 'bold' }}>
                {audit.site.braveAI.resultsTotal ?? 0}/{audit.site.braveAI.queriesTotal ?? 0}
              </span>
              
              {/* Status dots */}
              {audit.site.braveAI.diagnostics && (
                <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
                  {audit.site.braveAI.diagnostics.ok > 0 && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} title={`${audit.site.braveAI.diagnostics.ok} OK`} />
                  )}
                  {audit.site.braveAI.diagnostics.empty > 0 && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af' }} title={`${audit.site.braveAI.diagnostics.empty} Empty`} />
                  )}
                  {audit.site.braveAI.diagnostics.rate_limited > 0 && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} title={`${audit.site.braveAI.diagnostics.rate_limited} Rate-Limited`} />
                  )}
                  {audit.site.braveAI.diagnostics.error > 0 && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} title={`${audit.site.braveAI.diagnostics.error} Error`} />
                  )}
                </span>
              )}
              
              <span style={{ fontSize: 9 }}>▸</span>
            </button>
          )}
          
          {/* Disabled state when no queries */}
          {audit.site?.braveAI && (audit.site.braveAI.queriesTotal ?? 0) === 0 && (
            <div style={{
              marginTop: 8,
              fontSize: 11,
              padding: '6px 12px',
              borderRadius: 12,
              background: 'rgba(156,163,175,.1)',
              color: '#9ca3af',
              display: 'inline-block',
            }}>
              <span>🤖 Brave AI —</span>
            </div>
          )}
        </div>
        
        <div style={{ flex: 1 }}>
          <ScoreCard title="Structured" value={audit.scores.structured}/>
          {audit.scores.breakdown?.structured && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* FAQ Page (URL heuristic) */}
              {audit.scores.breakdown.structured.faqPagePresent !== undefined && (
                <span 
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 12,
                    background: audit.scores.breakdown.structured.faqPagePresent ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                    color: audit.scores.breakdown.structured.faqPagePresent ? '#10b981' : '#ef4444',
                  }}
                  title="Detected FAQ page by URL/title"
                >
                  FAQ page {audit.scores.breakdown.structured.faqPagePresent ? '✓' : '✗'}
                </span>
              )}
              {/* FAQ Schema (JSON-LD FAQPage) */}
              {audit.scores.breakdown.structured.faqSchemaPresent !== undefined && (
                <span 
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 12,
                    background: audit.scores.breakdown.structured.faqSchemaPresent ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                    color: audit.scores.breakdown.structured.faqSchemaPresent ? '#10b981' : '#ef4444',
                  }}
                  title="Detected FAQPage JSON-LD schema"
                >
                  FAQ schema {audit.scores.breakdown.structured.faqSchemaPresent ? '✓' : '✗'}
                </span>
              )}
              <span style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 12,
                background: 'rgba(56,189,248,.15)',
                color: '#38bdf8',
              }}>
                JSON-LD {Math.round(audit.scores.breakdown.structured.jsonLdCoveragePct)}%
              </span>
              {audit.scores.breakdown.structured.schemaTypes.length > 0 && (
                <span style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 12,
                  background: 'rgba(99,102,241,.15)',
                  color: '#6366f1',
                }} title={audit.scores.breakdown.structured.schemaTypes.join(', ')}>
                  Schemas: {audit.scores.breakdown.structured.schemaTypes.length}
                </span>
              )}
            </div>
          )}
        </div>
        
        <ScoreCard title="Answerability" value={audit.scores.answerability}/>
        <ScoreCard title="Trust" value={audit.scores.trust}/>
      </div>

      {audit.entity_recommendations && (
        <EntityRecommendations
          auditId={audit.id}
          orgName={audit.domain || 'Organization'}
          recommendations={audit.entity_recommendations}
        />
      )}

      <div className="tabs-container" style={{marginTop: 24}}>
        {(['scores', 'issues', 'pages', 'citations'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              // Clean navigation: only keep tab param, remove query/provider/path filters
              navigate(`${location.pathname}?tab=${tab}`, { replace: false });
            }}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'scores' && (
          <div>
            <h3 style={{marginTop:0}}>Score Breakdown</h3>
            <p style={{color: '#64748b'}}>Overall score: {Math.max(0, Math.min(100, Math.round(audit.scores.total || 0)))}%</p>
          </div>
        )}
        {activeTab === 'issues' && (
          <IssuesTable issues={audit.issues || []}/>
        )}
        {activeTab === 'pages' && (
          <PagesTable pages={audit.pages || []} auditId={id}/>
        )}
        {activeTab === 'citations' && (
          <Citations auditId={id!} citations={audit.citations}/>
        )}
      </div>
      
      {/* Brave AI Queries Modal (Phase F+) */}
      {showBraveModal && audit && (
        <BraveQueriesModal 
          auditId={audit.id}
          isOpen={showBraveModal}
          onClose={() => setShowBraveModal(false)}
        />
      )}
    </>
  );
}


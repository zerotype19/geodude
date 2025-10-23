import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import CategoryScoreCard from '/src/components/CategoryScoreCard';
import CitationSummaryCard from '/src/components/CitationSummaryCard';
import CompositeBanner from '/src/components/CompositeBanner';
import PagesTab from '/src/components/PagesTab';
import CitationsTab from '/src/components/CitationsTab';
import { apiGet } from '/src/lib/api';
import { useAuditDiagnostics } from '/src/hooks/useAuditDiagnostics';

interface Audit {
  id: string;
  project_id: string;
  root_url: string;
  started_at: string;
  finished_at?: string;
  status: 'running' | 'complete' | 'failed';
  pages_analyzed: number;
  category_scores?: any[];
  is_public?: boolean;
}

interface Page {
  id: string;
  url: string;
  status_code: number;
  content_type: string;
  aeo_score?: number;
  geo_score?: number;
  checks_json?: string;
}

export default function PublicAudit() {
  const { id } = useParams();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'pages' | 'citations'>('overview');
  
  const diagnostics = useAuditDiagnostics(id || '');

  useEffect(() => {
    if (!id) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch audit via public endpoint
        const auditData = await apiGet(`/api/public/audits/${id}`);
        setAudit(auditData.audit || auditData);
        
        // Fetch pages
        try {
          const pagesData = await apiGet(`/api/audits/${id}/pages`);
          setPages(pagesData.pages || []);
        } catch (pagesError) {
          console.warn('Failed to load pages:', pagesError);
        }
        
        setError(null);
      } catch (err: any) {
        console.error('Failed to load public audit:', err);
        setError(err.message || 'This audit is not publicly accessible');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 muted">Loading audit...</p>
        </div>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-danger mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2">Audit Not Available</h3>
          <p className="muted mb-6">{error || 'This audit is not publicly accessible'}</p>
          <a
            href="https://app.optiview.ai"
            className="btn-primary inline-block"
          >
            Run Your Own Audit
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="page-max container-px py-8">
        {/* Public Audit Header */}
        <div className="mb-8">
          <div className="card">
            <div className="card-body">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold">Public Audit Report</h1>
                    <span className="pill pill-brand">
                      Shared
                    </span>
                  </div>
                  <p className="text-lg  mb-1">{audit.root_url}</p>
                  <p className="text-sm muted">
                    {audit.started_at && new Date(audit.started_at).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <a
                  href="https://app.optiview.ai"
                  className="btn-primary flex-shrink-0"
                >
                  Run Your Own Audit →
                </a>
              </div>
              <div className="pt-4 border-t border-border">
                <p className="text-sm muted">
                  This is a public audit report shared via Optiview. You can run your own audit at{' '}
                  <a href="https://app.optiview.ai" className="text-brand hover:underline font-semibold">
                    app.optiview.ai
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8 border-b border-border">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-brand text-brand'
                  : 'border-transparent muted hover:border-border'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('pages')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pages'
                  ? 'border-brand text-brand'
                  : 'border-transparent muted hover:border-border'
              }`}
            >
              Pages ({pages.length})
            </button>
            <button
              onClick={() => setActiveTab('citations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'citations'
                  ? 'border-brand text-brand'
                  : 'border-transparent muted hover:border-border'
              }`}
            >
              Citations
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'pages' ? (
          <PagesTab pages={pages} auditId={id!} />
        ) : activeTab === 'citations' ? (
          <CitationsTab auditId={id!} />
        ) : (
          <>
            {/* Overview Tab */}
            
            {/* Composite Banner */}
            {diagnostics.composite && (
              <CompositeBanner data={diagnostics.composite} />
            )}

            {/* Category Scores */}
            {audit.category_scores && audit.category_scores.length > 0 && (
              <div className="mb-8">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold mb-1">Category Breakdown</h2>
                  <p className="text-sm muted">
                    Site performance across 6 key categories (0-100 scale)
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {audit.category_scores.map((categoryScore: any) => (
                    <CategoryScoreCard 
                      key={categoryScore.category} 
                      categoryScore={categoryScore} 
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Citation Summary */}
            <div className="mb-8">
              <CitationSummaryCard auditId={id!} />
            </div>

            {/* CTA Card */}
            <div className="card bg-brand-soft border-brand">
              <div className="card-body text-center">
                <h3 className="text-xl font-bold mb-2">Want to audit your own site?</h3>
                <p className="muted mb-4">
                  Get a complete AI visibility analysis for your domain in under 60 seconds.
                </p>
                <a
                  href="https://app.optiview.ai"
                  className="btn-primary inline-block"
                >
                  Run Free Audit →
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


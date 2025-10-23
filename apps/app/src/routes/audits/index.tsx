import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { apiPost, apiGet } from '../../lib/api';

interface Audit {
  id: string;
  project_id: string;
  root_url: string;
  started_at: string;
  finished_at?: string;
  status: 'running' | 'complete' | 'failed';
  pages_analyzed: number;
  composite_score?: number;
}

const API_BASE = 'https://api.optiview.ai';

export default function AuditsIndex() {
  const { me, isAuthed, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMagicLinkForm, setShowMagicLinkForm] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSending, setMagicLinkSending] = useState(false);
  const [createForm, setCreateForm] = useState({
    project_id: '',
    root_url: '',
    site_description: '',
    max_pages: 200
  });

  useEffect(() => {
    if (!authLoading) {
      fetchAudits();
    }
  }, [authLoading]);

  const fetchAudits = async () => {
    try {
      const data = await apiGet<{ audits: Audit[] }>('/api/audits');
      // Composite score is now included in the audit object from the API
      setAudits(data.audits || []);
    } catch (error) {
      console.error('Failed to fetch audits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAuditClick = () => {
    setShowCreateForm(false);
    setShowMagicLinkForm(true);
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicLinkSending(true);
    
    try {
      await apiPost('/v1/auth/magic/request', {
        email: magicLinkEmail,
        intent: 'start_audit',
        payload: createForm,
        redirectPath: '/audits'
      });
      
      navigate(`/auth/check-email?email=${encodeURIComponent(magicLinkEmail)}`);
    } catch (error) {
      console.error('Failed to send magic link:', error);
      alert('Failed to send magic link. Please try again.');
    } finally {
      setMagicLinkSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'complete': // Legacy support
        return 'pill-success';
      case 'running': 
        return 'pill-brand';
      case 'failed': 
        return 'pill-danger';
      default: 
        return '';
    }
  };

  const formatScore = (score?: number) => {
    if (score === undefined || score === null) return 'N/A';
    return Math.round(score);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-surface-2 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto"></div>
          <p className="mt-4 muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="page-max container-px py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Audit Dashboard</h1>
          <p className="mt-2 muted">
            Monitor and analyze your website's AI discoverability and optimization
          </p>
        </div>

        {/* Create Audit Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary"
          >
            Start New Audit
          </button>
        </div>

        {/* Create Audit Modal - Step 1: Audit Details */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="card p-6 w-full max-w-md">
              <h2 className="section-title mb-4">Start New Audit</h2>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                handleStartAuditClick();
              }}>
                <div className="mb-4">
                  <label className="field-label">
                    Project ID
                  </label>
                  <input
                    type="text"
                    value={createForm.project_id}
                    onChange={(e) => setCreateForm({ ...createForm, project_id: e.target.value })}
                    className="field"
                    placeholder="e.g., prj_demo"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="field-label">
                    Root URL
                  </label>
                  <div className="flex items-center field p-0 overflow-hidden">
                    <span className="px-3 py-2 bg-surface-2 subtle border-r border-border select-none">
                      https://
                    </span>
                    <input
                      type="text"
                      value={createForm.root_url.replace(/^https?:\/\//, '')}
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/^https?:\/\//, '');
                        setCreateForm({ ...createForm, root_url: `https://${cleanValue}` });
                      }}
                      className="flex-1 px-3 py-2 focus:outline-none border-0"
                      placeholder="example.com"
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="field-label">
                    Site Description
                  </label>
                  <textarea
                    value={createForm.site_description}
                    onChange={(e) => setCreateForm({ ...createForm, site_description: e.target.value })}
                    className="field"
                    placeholder="Describe what this site is about, what it offers, and what makes it unique..."
                    rows={4}
                    required
                  />
                  <p className="mt-1 text-sm subtle">
                    This description will be used to generate relevant citation queries across AI sources.
                  </p>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    Continue →
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Magic Link Modal - Step 2: Email for Authentication */}
        {showMagicLinkForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="card p-6 w-full max-w-md">
              <h2 className="section-title mb-4">Secure Your Audit</h2>
              
              <div className="card-muted p-4 mb-4">
                <p className="text-sm">
                  🔐 <strong>Magic link authentication</strong>
                </p>
                <p className="text-sm text-brand mt-1">
                  We'll send you a secure link to start this audit. This ensures your audits are private and only accessible by you.
                </p>
              </div>

              <form onSubmit={sendMagicLink}>
                <div className="mb-4">
                  <label className="field-label">
                    Your Email
                  </label>
                  <input
                    type="email"
                    value={magicLinkEmail}
                    onChange={(e) => setMagicLinkEmail(e.target.value)}
                    className="field"
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                  />
                  <p className="mt-1 text-sm subtle">
                    We'll send you a secure sign-in link (expires in 20 minutes)
                  </p>
                </div>

                <div className="card-muted p-3 mb-4">
                  <p className="text-xs font-medium">Audit Summary:</p>
                  <p className="text-xs muted mt-1">
                    <strong>URL:</strong> {createForm.root_url || 'Not specified'}
                  </p>
                  <p className="text-xs muted">
                    <strong>Project:</strong> {createForm.project_id || 'Not specified'}
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMagicLinkForm(false);
                      setShowCreateForm(true);
                    }}
                    className="btn-ghost"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={magicLinkSending}
                    className="btn-primary disabled:opacity-60"
                  >
                    {magicLinkSending ? 'Sending...' : 'Send Magic Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Audits Table */}
        <div className="card">
          <div className="card-header">
            <h2 className="section-title">Recent Audits</h2>
          </div>

          {audits.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="subtle mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No audits yet</h3>
              <p className="muted mb-4">Get started by creating your first audit</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary"
              >
                Start Your First Audit
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="ui">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>URL</th>
                    <th>Status</th>
                    <th>Optiview Score</th>
                    <th>Pages</th>
                    <th>Started</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((audit) => (
                    <tr key={audit.id}>
                      <td>
                        <span className="font-medium">{audit.project_id}</span>
                      </td>
                      <td>
                        <a href={audit.root_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                          {audit.root_url}
                        </a>
                      </td>
                      <td>
                        <span className={`pill ${getStatusColor(audit.status)}`}>
                          {audit.status}
                        </span>
                      </td>
                      <td>
                        <span className={`text-base font-semibold ${
                          audit.composite_score 
                            ? audit.composite_score >= 85 
                              ? 'text-success' 
                              : audit.composite_score >= 60 
                                ? 'text-warn' 
                                : 'text-danger'
                            : 'subtle'
                        }`}>
                          {formatScore(audit.composite_score)}
                        </span>
                      </td>
                      <td>
                        {audit.pages_analyzed}
                      </td>
                      <td>
                        <span className="subtle">{new Date(audit.started_at).toLocaleDateString()}</span>
                      </td>
                      <td>
                        <Link
                          to={`/audits/${audit.id}`}
                          className="text-brand hover:underline"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

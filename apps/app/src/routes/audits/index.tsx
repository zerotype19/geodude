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
  aeo_score?: number;
  geo_score?: number;
  geo_adjusted?: number; // GEO score adjusted for real-world citations
  pages_analyzed: number;
  avg_aeo_score: number;
  avg_geo_score: number;
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
        return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatScore = (score?: number) => {
    if (score === undefined || score === null) return 'N/A';
    return Math.round(score);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Audit Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Monitor and analyze your website's AEO and GEO performance
          </p>
        </div>

        {/* Create Audit Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Start New Audit
          </button>
        </div>

        {/* Create Audit Modal - Step 1: Audit Details */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Start New Audit</h2>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                handleStartAuditClick();
              }}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project ID
                  </label>
                  <input
                    type="text"
                    value={createForm.project_id}
                    onChange={(e) => setCreateForm({ ...createForm, project_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., prj_demo"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Root URL
                  </label>
                  <div className="flex items-center border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500">
                    <span className="px-3 py-2 bg-gray-50 text-gray-500 border-r border-gray-300 select-none">
                      https://
                    </span>
                    <input
                      type="text"
                      value={createForm.root_url.replace(/^https?:\/\//, '')}
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/^https?:\/\//, '');
                        setCreateForm({ ...createForm, root_url: `https://${cleanValue}` });
                      }}
                      className="flex-1 px-3 py-2 focus:outline-none rounded-r-md"
                      placeholder="example.com"
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site Description
                  </label>
                  <textarea
                    value={createForm.site_description}
                    onChange={(e) => setCreateForm({ ...createForm, site_description: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe what this site is about, what it offers, and what makes it unique..."
                    rows={4}
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    This description will be used to generate relevant citation queries across AI sources.
                  </p>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
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
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Secure Your Audit</h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  🔐 <strong>Magic link authentication</strong>
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  We'll send you a secure link to start this audit. This ensures your audits are private and only accessible by you.
                </p>
              </div>

              <form onSubmit={sendMagicLink}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Email
                  </label>
                  <input
                    type="email"
                    value={magicLinkEmail}
                    onChange={(e) => setMagicLinkEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    We'll send you a secure sign-in link (expires in 20 minutes)
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-700 font-medium">Audit Summary:</p>
                  <p className="text-xs text-gray-600 mt-1">
                    <strong>URL:</strong> {createForm.root_url || 'Not specified'}
                  </p>
                  <p className="text-xs text-gray-600">
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
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={magicLinkSending}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-60"
                  >
                    {magicLinkSending ? 'Sending...' : 'Send Magic Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Audits Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Audits</h2>
          </div>

          {audits.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No audits yet</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first audit</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Start Your First Audit
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AEO Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="inline-flex items-center">
                        GEO Score
                        <span className="ml-1 text-gray-400" title="Adjusted for real-world LLM citations">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </span>
                      </span>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pages
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {audits.map((audit) => (
                    <tr key={audit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {audit.project_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <a href={audit.root_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                          {audit.root_url}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(audit.status)}`}>
                          {audit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatScore(audit.aeo_score)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center">
                          {formatScore(audit.geo_adjusted !== undefined && audit.geo_adjusted !== null ? audit.geo_adjusted : audit.geo_score)}
                          {audit.geo_adjusted !== undefined && audit.geo_adjusted !== null && audit.geo_adjusted !== audit.geo_score && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title={`Adjusted from ${formatScore(audit.geo_score)} based on citation performance`}>
                              +
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {audit.pages_analyzed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(audit.started_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          to={`/audits/${audit.id}`}
                          className="text-blue-600 hover:text-blue-900"
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

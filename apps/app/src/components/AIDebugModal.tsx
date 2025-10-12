import { useEffect, useState } from 'react';

interface AIDebugResult {
  bot: string;
  status: number;
  ok: boolean;
  diff: boolean;
  server: string;
  cfRay?: string;
  akamai?: string;
  blocked: boolean;
}

interface AIDebugData {
  ok: boolean;
  auditId: string;
  aiAccess: {
    baselineStatus: number;
    results: AIDebugResult[];
  };
}

interface AIDebugModalProps {
  auditId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AIDebugModal({ auditId, isOpen, onClose }: AIDebugModalProps) {
  const [data, setData] = useState<AIDebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && auditId) {
      fetchDebugData();
    }
  }, [isOpen, auditId]);

  const fetchDebugData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://api.optiview.ai/v1/debug/ai-access/${auditId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch debug data: ${response.status}`);
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load debug data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return '#10b981'; // Green
    if (status === 429) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  const getStatusText = (status: number) => {
    if (status === 200) return 'OK';
    if (status === 429) return 'Rate Limited';
    return `Error ${status}`;
  };

  const getBotIcon = (bot: string) => {
    switch (bot) {
      case 'GPTBot': return '🤖';
      case 'Claude-Web': return '🧠';
      case 'ClaudeBot': return '🧠';
      case 'PerplexityBot': return '🔍';
      case 'CCBot': return '🦀';
      case 'Google-Extended': return '🌐';
      case 'Bytespider': return '🕷️';
      default: return '🤖';
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '600',
            color: '#1f2937',
          }}>
            AI Crawler Debug Info
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '16px', color: '#6b7280' }}>Loading debug data...</div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            marginBottom: '16px',
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {data && (
          <div>
            {/* Summary */}
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                Summary
              </h3>
              <div style={{ fontSize: '14px', color: '#64748b' }}>
                <div><strong>Audit ID:</strong> {data.auditId}</div>
                <div><strong>Baseline Status:</strong> {data.aiAccess.baselineStatus}</div>
                <div><strong>Total Bots Tested:</strong> {data.aiAccess.results.length}</div>
                <div><strong>Blocked Bots:</strong> {data.aiAccess.results.filter(r => r.blocked).length}</div>
              </div>
            </div>

            {/* Bot Results */}
            <div>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                Bot Test Results
              </h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {data.aiAccess.results.map((result, index) => (
                  <div
                    key={index}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '16px',
                      backgroundColor: result.blocked ? '#fef2f2' : '#f0fdf4',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>{getBotIcon(result.bot)}</span>
                        <span style={{ fontWeight: '600', fontSize: '16px' }}>{result.bot}</span>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: getStatusColor(result.status),
                            color: 'white',
                          }}
                        >
                          {result.status}
                        </span>
                        <span style={{
                          fontSize: '14px',
                          color: getStatusColor(result.status),
                          fontWeight: '500',
                        }}>
                          {getStatusText(result.status)}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                    }}>
                      <div><strong>Server:</strong> {result.server}</div>
                      <div><strong>Blocked:</strong> {result.blocked ? 'Yes' : 'No'}</div>
                      {result.cfRay && <div><strong>CF-Ray:</strong> {result.cfRay}</div>}
                      <div><strong>Diff from Baseline:</strong> {result.diff ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Raw Data Link */}
            <div style={{
              marginTop: '20px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                Need the raw data?
              </div>
              <a
                href={`https://api.optiview.ai/v1/debug/ai-access/${auditId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#3b82f6',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                View Raw JSON →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

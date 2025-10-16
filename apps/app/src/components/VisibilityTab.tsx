import React from 'react';
import type { VisibilitySummary } from '../services/api';

interface VisibilityTabProps {
  visibilitySummary?: VisibilitySummary;
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      padding: 16,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}

export default function VisibilityTab({ visibilitySummary }: VisibilityTabProps) {
  if (!visibilitySummary) {
    return (
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 24,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: 16, color: '#6b7280', marginBottom: 8 }}>
          No visibility data available
        </div>
        <div style={{ fontSize: 14, color: '#9ca3af' }}>
          Visibility data will appear here once AI assistant citations are detected
        </div>
      </div>
    );
  }

  const { totalCitations, bySource, topUrls } = visibilitySummary;

  return (
    <div>
      {/* Summary Tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <Tile label="Total Citations" value={totalCitations} />
        <Tile label="Brave" value={bySource.brave || 0} />
        <Tile label="ChatGPT" value={bySource.chatgpt || 0} />
        <Tile label="Claude" value={bySource.claude || 0} />
        <Tile label="Perplexity" value={bySource.perplexity || 0} />
      </div>

      {/* Explanatory Panel */}
      <div style={{
        background: '#faf5ff',
        border: '1px solid #d8b4fe',
        borderRadius: 8,
        padding: 16,
        marginBottom: 24
      }}>
        <div style={{ fontSize: 14, color: '#7c3aed', lineHeight: 1.6 }}>
          <strong>What is Visibility?</strong><br />
          Visibility represents how often AI assistants reference your domain. A 0% score means we found no citations or mentions from major AI systems. 
          Improve by adding structured Q&A content and earning references from authoritative sources.
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => {
              // Navigate to citations tab
              const url = new URL(window.location.href);
              url.searchParams.set('tab', 'citations');
              window.history.pushState({}, '', url.toString());
              window.location.reload();
            }}
            style={{
              background: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 14,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            View citations →
          </button>
        </div>
      </div>

      {/* Top Pages by Citations */}
      {topUrls && topUrls.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>
            Top Pages by Citations
          </h3>
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                    Page URL
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                    Total
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                    By Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {topUrls.map((urlData, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <a
                        href={urlData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#3b82f6',
                          textDecoration: 'underline',
                          wordBreak: 'break-all'
                        }}
                      >
                        {urlData.url}
                      </a>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                      {urlData.total}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>
                      {Object.entries(urlData.bySource)
                        .filter(([_, count]) => count > 0)
                        .map(([source, count]) => (
                          <span key={source} style={{ marginRight: 12 }}>
                            {source}: {count}
                          </span>
                        ))
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

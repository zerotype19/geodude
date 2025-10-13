export default function Footer() {
  return (
    <footer style={{
      marginTop: '60px',
      paddingTop: '20px',
      borderTop: '1px solid #e5e7eb',
      textAlign: 'center',
      color: '#6b7280',
      fontSize: '14px'
    }}>
      <div style={{ marginBottom: '12px' }}>
        <a href="https://optiview.ai/docs/faq.html" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', margin: '0 8px' }}>
          FAQ
        </a>
        <a href="https://optiview.ai/docs/visibility.html" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', margin: '0 8px' }}>
          Visibility Intelligence
        </a>
        <a href="https://optiview.ai/docs/citations.html" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', margin: '0 8px' }}>
          Citations Guide
        </a>
        <a href="https://optiview.ai/docs/audit.html" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', margin: '0 8px' }}>
          Audit Checks
        </a>
        <a href="https://optiview.ai/docs/bots.html" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', margin: '0 8px' }}>
          AI Bots
        </a>
        <a href="https://optiview.ai/docs/security.html" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', margin: '0 8px' }}>
          Security
        </a>
        <a href="https://optiview.ai/status.html" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', margin: '0 8px' }}>
          Status
        </a>
      </div>
      <div style={{ color: '#9ca3af', fontSize: '12px' }}>
        <a href="https://optiview.ai" target="_blank" rel="noopener noreferrer" style={{ color: '#6b7280', textDecoration: 'none' }}>
          optiview.ai
        </a>
        {' • '}
        <a href="/" style={{ color: '#6b7280', textDecoration: 'none' }}>
          app.optiview.ai
        </a>
      </div>
    </footer>
  );
}
